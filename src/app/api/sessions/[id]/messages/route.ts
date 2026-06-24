// POST /api/sessions/[id]/messages — persistent follow-up Q&A.
// Loads stored document + analysis + prior messages, retrieves relevant legal
// sources, calls OpenAI, then saves the user question and assistant reply.
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FOLLOW_UP_CHAT_SYSTEM_PROMPT,
  buildChatContextMessage,
} from "@/lib/prompts";
import { getModel } from "@/lib/openai";
import { runChatCompletion } from "@/lib/openaiChat";
import {
  buildSourceSearchQuery,
  categoriesForMode,
  searchLegalSources,
  formatSourcesBlock,
} from "@/lib/legalSources";
import { sanitizeHistory, toMessageParams } from "@/lib/chatHistory";
import { isAnalysisMode } from "@/lib/modes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 5_000;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: { question?: unknown };
  try {
    body = (await req.json()) as { question?: unknown };
  } catch {
    return NextResponse.json({ error: "Ожидается JSON." }, { status: 400 });
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "Вопрос не может быть пустым." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: "Вопрос слишком длинный. Сократите его." }, { status: 400 });
  }

  // Load the stored session with its prior messages.
  let session;
  try {
    session = await prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  } catch (err) {
    console.error(
      `[messages:load] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json({ error: "Ошибка базы данных." }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Сессия не найдена." }, { status: 404 });
  }

  const analysisMode = isAnalysisMode(session.analysisMode)
    ? session.analysisMode
    : null;

  // Retrieve relevant sources for this question.
  const sources = analysisMode
    ? await searchLegalSources(
        buildSourceSearchQuery({
          mode: analysisMode,
          documentText: session.documentText,
          extra: question,
        }),
        categoriesForMode(analysisMode),
      )
    : [];
  const sourcesBlock = formatSourcesBlock(sources);

  const history = sanitizeHistory(session.messages);
  const model = getModel();

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: FOLLOW_UP_CHAT_SYSTEM_PROMPT },
    {
      role: "system",
      content: buildChatContextMessage({
        documentText: session.documentText,
        analysisMode: session.analysisMode,
        initialAnalysis: session.initialAnalysis,
        sourcesBlock,
      }),
    },
    ...toMessageParams(history),
    { role: "user", content: question },
  ];

  console.info(
    `[messages] session=${id} mode=${session.analysisMode} messages=${history.length} sources=${sources.length} model=${model}`,
  );

  const result = await runChatCompletion(messages);
  if (!result.ok) {
    console.error(
      `[messages] error session=${id} model=${model} status=${result.error.details.status} code=${result.error.details.code ?? "none"} message=${result.error.details.message ?? "none"}`,
    );
    return NextResponse.json(
      { error: result.error.friendly, details: result.error.details },
      { status: result.error.httpStatus },
    );
  }

  // Persist the user question and the assistant reply, and bump updatedAt.
  try {
    await prisma.$transaction([
      prisma.chatMessage.create({
        data: { sessionId: id, role: "user", content: question },
      }),
      prisma.chatMessage.create({
        data: { sessionId: id, role: "assistant", content: result.reply },
      }),
      prisma.chatSession.update({
        where: { id },
        data: { updatedAt: new Date() },
      }),
    ]);
  } catch (err) {
    console.error(
      `[messages:save] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    // The reply was generated; still return it even if persistence failed.
    return NextResponse.json({ reply: result.reply, persisted: false });
  }

  const messagesOut = await prisma.chatMessage.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ reply: result.reply, messages: messagesOut });
}

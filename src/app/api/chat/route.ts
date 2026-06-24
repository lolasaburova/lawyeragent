// POST /api/chat — stateless follow-up Q&A (kept for backward compatibility).
// The persistent flow is POST /api/sessions/[id]/messages. Both share the same
// source-retrieval + OpenAI helper. The API key is never sent to the browser.
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextRequest, NextResponse } from "next/server";
import { isAnalysisMode } from "@/lib/modes";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DOC_LENGTH = 60_000;
const MAX_QUESTION_LENGTH = 5_000;

interface ChatBody {
  documentText?: unknown;
  analysisMode?: unknown;
  initialAnalysis?: unknown;
  messages?: unknown;
  question?: unknown;
}

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json(
      { error: "Некорректный запрос: ожидается JSON." },
      { status: 400 },
    );
  }

  const documentText =
    typeof body.documentText === "string" ? body.documentText : "";
  const initialAnalysis =
    typeof body.initialAnalysis === "string" ? body.initialAnalysis : "";
  const analysisMode = body.analysisMode;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const history = sanitizeHistory(body.messages);

  if (!question) {
    return NextResponse.json({ error: "Вопрос не может быть пустым." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: "Вопрос слишком длинный. Сократите его." }, { status: 400 });
  }
  if (!initialAnalysis.trim()) {
    return NextResponse.json(
      { error: "Нет первоначального анализа. Сначала выполните анализ документа." },
      { status: 400 },
    );
  }
  if (!isAnalysisMode(analysisMode)) {
    return NextResponse.json({ error: "Некорректный режим анализа." }, { status: 400 });
  }
  if (documentText.length > MAX_DOC_LENGTH) {
    return NextResponse.json({ error: "Текст документа слишком длинный для чата." }, { status: 400 });
  }

  const searchQuery = buildSourceSearchQuery({
    mode: analysisMode,
    documentText,
    extra: question,
  });
  const sources = await searchLegalSources(
    searchQuery,
    categoriesForMode(analysisMode),
  );
  const sourcesBlock = formatSourcesBlock(sources);

  const model = getModel();
  const contextMessage = buildChatContextMessage({
    documentText,
    analysisMode,
    initialAnalysis,
    sourcesBlock,
  });

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: FOLLOW_UP_CHAT_SYSTEM_PROMPT },
    { role: "system", content: contextMessage },
    ...toMessageParams(history),
    { role: "user", content: question },
  ];

  console.info(
    `[chat] mode=${analysisMode} docLength=${documentText.length} analysisLength=${initialAnalysis.length} messages=${history.length} sources=${sources.length} model=${model}`,
  );

  const result = await runChatCompletion(messages);
  if (!result.ok) {
    console.error(
      `[chat] error mode=${analysisMode} messages=${history.length} model=${model} status=${result.error.details.status} code=${result.error.details.code ?? "none"} message=${result.error.details.message ?? "none"}`,
    );
    return NextResponse.json(
      { error: result.error.friendly, details: result.error.details },
      { status: result.error.httpStatus },
    );
  }

  return NextResponse.json({ reply: result.reply });
}

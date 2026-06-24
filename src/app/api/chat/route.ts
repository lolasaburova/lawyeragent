// POST /api/chat — follow-up Q&A after the initial analysis.
// The API key lives only in process.env and is never sent to the browser.
//
// MVP scope: no persistence. The document text, initial analysis and chat
// history are sent per-request from the frontend (React state) and are NOT
// stored on the server. As with /api/analyze, banking/production use requires a
// PRIVATE DEPLOYMENT with a separate data-processing policy.
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextRequest, NextResponse } from "next/server";
import { isAnalysisMode } from "@/lib/modes";
import {
  FOLLOW_UP_CHAT_SYSTEM_PROMPT,
  buildChatContextMessage,
} from "@/lib/prompts";
import { getModel, getOpenAIClient, hasApiKey } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 1500;
const MAX_DOC_LENGTH = 60_000;
const MAX_QUESTION_LENGTH = 5_000;
const MAX_HISTORY_MESSAGES = 20; // keep only the most recent turns for context.

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  documentText?: unknown;
  analysisMode?: unknown;
  initialAnalysis?: unknown;
  messages?: unknown;
  question?: unknown;
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const m of raw) {
    if (
      m &&
      typeof m === "object" &&
      (m as { role?: unknown }).role &&
      typeof (m as { content?: unknown }).content === "string"
    ) {
      const role = (m as { role: unknown }).role;
      const content = (m as { content: string }).content;
      if ((role === "user" || role === "assistant") && content.trim()) {
        out.push({ role, content });
      }
    }
  }
  // Keep only the most recent messages to bound the prompt size.
  return out.slice(-MAX_HISTORY_MESSAGES);
}

export async function POST(req: NextRequest) {
  // 1. Parse body.
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
  const history = sanitizeMessages(body.messages);

  // 2. Validate inputs.
  if (!question) {
    return NextResponse.json(
      { error: "Вопрос не может быть пустым." },
      { status: 400 },
    );
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: "Вопрос слишком длинный. Сократите его." },
      { status: 400 },
    );
  }
  if (!initialAnalysis.trim()) {
    return NextResponse.json(
      { error: "Нет первоначального анализа. Сначала выполните анализ документа." },
      { status: 400 },
    );
  }
  if (!isAnalysisMode(analysisMode)) {
    return NextResponse.json(
      { error: "Некорректный режим анализа." },
      { status: 400 },
    );
  }
  if (documentText.length > MAX_DOC_LENGTH) {
    return NextResponse.json(
      { error: "Текст документа слишком длинный для чата." },
      { status: 400 },
    );
  }

  // 3. Check API key (without exposing it).
  if (!hasApiKey()) {
    return NextResponse.json(
      {
        error:
          "OpenAI API ключ не настроен на сервере. Добавьте переменную окружения OPENAI_API_KEY.",
      },
      { status: 503 },
    );
  }

  // 4. Build messages: system prompt + context + history + latest question.
  const model = getModel();
  const contextMessage = buildChatContextMessage({
    documentText,
    analysisMode,
    initialAnalysis,
  });

  // Narrow each history role to a literal so it satisfies the discriminated
  // ChatCompletionMessageParam union (required for `next build` type-checking).
  const historyParams: ChatCompletionMessageParam[] = history.map((m) =>
    m.role === "user"
      ? { role: "user" as const, content: m.content }
      : { role: "assistant" as const, content: m.content },
  );

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: FOLLOW_UP_CHAT_SYSTEM_PROMPT },
    { role: "system", content: contextMessage },
    ...historyParams,
    { role: "user", content: question },
  ];

  // Safe log: no document text, no chat content, no API key.
  console.info(
    `[chat] mode=${analysisMode} docLength=${documentText.length} analysisLength=${initialAnalysis.length} messages=${history.length} model=${model}`,
  );

  // 5. Call OpenAI with a 45s AbortController timeout.
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create(
      {
        model,
        temperature: 0.2,
        // Use max_completion_tokens (newer models reject the legacy max_tokens).
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages,
      },
      { signal: controller.signal },
    );

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json(
        { error: "Модель вернула пустой ответ. Попробуйте ещё раз." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    const isTimeout =
      timedOut ||
      err instanceof OpenAI.APIUserAbortError ||
      (err instanceof Error && err.name === "AbortError");

    let status: number | undefined;
    let code: string | undefined;
    let type: string | undefined;
    let errMessage: string | undefined;

    if (err instanceof OpenAI.APIError) {
      status = err.status;
      code = err.code ?? undefined;
      type = err.type ?? undefined;
      errMessage = err.message;
    } else if (err instanceof Error) {
      errMessage = err.message;
    }

    let friendly = "Ошибка при обращении к AI-сервису. Попробуйте позже.";
    let httpStatus = 502;

    if (isTimeout) {
      friendly = "OpenAI request timed out after 45 seconds.";
      httpStatus = 504;
      code = code ?? "timeout";
      type = type ?? "timeout";
    } else if (status === 401) {
      friendly = "OpenAI API ключ недействителен. Проверьте OPENAI_API_KEY.";
      httpStatus = 401;
    } else if (status === 429) {
      friendly =
        "Превышен лимит запросов к OpenAI или закончилась квота. Попробуйте позже.";
      httpStatus = 429;
    } else if (status === 400) {
      friendly =
        "OpenAI отклонил запрос. Возможно, выбранная модель недоступна (проверьте OPENAI_MODEL).";
      httpStatus = 400;
    }

    // Safe log: mode, lengths, message count, model, status, code, message.
    console.error(
      `[chat] OpenAI error mode=${analysisMode} docLength=${documentText.length} analysisLength=${initialAnalysis.length} messages=${history.length} model=${model} status=${
        status ?? (isTimeout ? "timeout" : "unknown")
      } code=${code ?? "none"} message=${errMessage ?? "none"}`,
    );

    return NextResponse.json(
      {
        error: friendly,
        details: {
          status: status ?? (isTimeout ? "timeout" : "unknown"),
          code: code ?? null,
          type: type ?? null,
          message: errMessage ?? null,
        },
      },
      { status: httpStatus },
    );
  } finally {
    clearTimeout(timeout);
  }
}

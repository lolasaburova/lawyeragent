// Shared OpenAI Chat Completions helper used by /api/analyze, /api/chat and
// /api/sessions/[id]/messages. Centralizes the model choice, the 90s timeout,
// the token cap, and SAFE error mapping (never exposes the API key).
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getModel, getOpenAIClient, hasApiKey } from "@/lib/openai";

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 900;

export interface SafeErrorDetails {
  status: number | string;
  code: string | null;
  type: string | null;
  message: string | null;
}

export interface ChatErrorInfo {
  friendly: string;
  httpStatus: number;
  details: SafeErrorDetails;
}

export type ChatResult =
  | { ok: true; reply: string }
  | { ok: false; error: ChatErrorInfo };

/**
 * Run a Chat Completions request and return either the reply or a structured,
 * safe error. Logging is the caller's responsibility (so it can include the
 * route-specific safe fields); this helper never logs document/chat content.
 */
export async function runChatCompletion(
  messages: ChatCompletionMessageParam[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<ChatResult> {
  if (!hasApiKey()) {
    return {
      ok: false,
      error: {
        friendly:
          "OpenAI API ключ не настроен на сервере. Добавьте переменную окружения OPENAI_API_KEY.",
        httpStatus: 503,
        details: { status: 503, code: "no_api_key", type: null, message: null },
      },
    };
  }

  const model = getModel();
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
        temperature: opts.temperature ?? 0.2,
        // Newer models reject the legacy max_tokens parameter.
        max_completion_tokens: opts.maxTokens ?? MAX_OUTPUT_TOKENS,
        messages,
      },
      { signal: controller.signal },
    );

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      return {
        ok: false,
        error: {
          friendly: "Модель вернула пустой ответ. Попробуйте ещё раз.",
          httpStatus: 502,
          details: { status: 502, code: "empty_response", type: null, message: null },
        },
      };
    }
    return { ok: true, reply };
  } catch (err: unknown) {
    return { ok: false, error: mapOpenAIError(err, timedOut) };
  } finally {
    clearTimeout(timeout);
  }
}

export function mapOpenAIError(err: unknown, timedOut: boolean): ChatErrorInfo {
  const isTimeout =
    timedOut ||
    err instanceof OpenAI.APIUserAbortError ||
    (err instanceof Error && err.name === "AbortError");

  let status: number | undefined;
  let code: string | undefined;
  let type: string | undefined;
  let message: string | undefined;

  if (err instanceof OpenAI.APIError) {
    status = err.status;
    code = err.code ?? undefined;
    type = err.type ?? undefined;
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  let friendly = "Ошибка при обращении к AI-сервису. Попробуйте позже.";
  let httpStatus = 502;

  if (isTimeout) {
    friendly = "OpenAI request timed out after 90 seconds.";
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

  return {
    friendly,
    httpStatus,
    details: {
      status: status ?? (isTimeout ? "timeout" : "unknown"),
      code: code ?? null,
      type: type ?? null,
      message: message ?? null,
    },
  };
}

// POST /api/analyze — server-side OpenAI call. The API key lives only in
// process.env and is never sent to the browser.
//
// NOTE FOR BANKING / PRODUCTION USE: For real banking documents this endpoint
// must run in a PRIVATE DEPLOYMENT with a separate data-processing policy
// (e.g. a zero-retention OpenAI enterprise agreement or a self-hosted model),
// plus compliance review. The MVP does not persist documents and does not log
// their content, but that is not by itself sufficient for regulated banking data.
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { isAnalysisMode } from "@/lib/modes";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts";
import { getModel, getOpenAIClient, hasApiKey } from "@/lib/openai";

// Run on the Node.js runtime (the OpenAI SDK needs Node APIs).
export const runtime = "nodejs";
// Never cache analysis responses.
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 60_000; // ~ guard against accidental huge payloads.
const REQUEST_TIMEOUT_MS = 90_000; // Abort the OpenAI call after 90 seconds.
const MAX_OUTPUT_TOKENS = 900; // Test-mode cap to keep responses fast/cheap.

interface AnalyzeBody {
  text?: unknown;
  mode?: unknown;
  additionalInstruction?: unknown;
}

export async function POST(req: NextRequest) {
  // 1. Parse body.
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json(
      { error: "Некорректный запрос: ожидается JSON." },
      { status: 400 },
    );
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const mode = body.mode;
  const additionalInstruction =
    typeof body.additionalInstruction === "string"
      ? body.additionalInstruction
      : undefined;

  // 2. Validate text.
  if (!text) {
    return NextResponse.json(
      { error: "Текст документа не может быть пустым. Вставьте текст или загрузите файл." },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: `Текст слишком длинный (${text.length} символов). Максимум ${MAX_TEXT_LENGTH}. Разбейте документ на части.`,
      },
      { status: 400 },
    );
  }

  // 3. Validate mode.
  if (!isAnalysisMode(mode)) {
    return NextResponse.json(
      { error: "Не выбран корректный режим анализа." },
      { status: 400 },
    );
  }

  // 4. Check API key (without exposing it).
  if (!hasApiKey()) {
    return NextResponse.json(
      {
        error:
          "OpenAI API ключ не настроен на сервере. Добавьте переменную окружения OPENAI_API_KEY (локально в .env.local, на Vercel — в Project Settings → Environment Variables).",
      },
      { status: 503 },
    );
  }

  // 5. Build prompts. We do NOT log the document text — only its length.
  const model = getModel();
  const userPrompt = buildUserPrompt({ mode, text, additionalInstruction });
  console.info(
    `[analyze] mode=${mode} textLength=${text.length} model=${model}`,
  );

  // 6. Call OpenAI via the Chat Completions API, with a 45s AbortController timeout.
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
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      },
      { signal: controller.signal },
    );

    const result = completion.choices[0]?.message?.content?.trim();
    if (!result) {
      return NextResponse.json(
        { error: "Модель вернула пустой ответ. Попробуйте ещё раз." },
        { status: 502 },
      );
    }

    return NextResponse.json({ result });
  } catch (err: unknown) {
    // Was this our 45s timeout (or any abort)?
    const isTimeout =
      timedOut ||
      err instanceof OpenAI.APIUserAbortError ||
      (err instanceof Error && err.name === "AbortError");

    // Extract safe diagnostics. OpenAI's APIError carries status/code/type and
    // a message about the API call — never the API key or the document text.
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

    // Friendly, user-facing message.
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
        "OpenAI отклонил запрос. Возможно, выбранная модель недоступна для вашего ключа (проверьте OPENAI_MODEL).";
      httpStatus = 400;
    }

    // Safe log: mode, text length, model, status, code, message. No key, no text.
    console.error(
      `[analyze] OpenAI error mode=${mode} textLength=${text.length} model=${model} status=${
        status ?? (isTimeout ? "timeout" : "unknown")
      } code=${code ?? "none"} message=${errMessage ?? "none"}`,
    );

    // Safe diagnostics for the frontend (no API key is ever included here).
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

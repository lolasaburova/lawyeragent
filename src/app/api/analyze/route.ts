// POST /api/analyze — server-side OpenAI call with legal-source retrieval.
// The API key lives only in process.env and is never sent to the browser.
//
// NOTE FOR BANKING / PRODUCTION USE: For real banking documents this endpoint
// must run in a PRIVATE DEPLOYMENT with a separate data-processing policy
// (e.g. a zero-retention OpenAI enterprise agreement or a self-hosted model),
// plus compliance review. The MVP does not log document content, but that is
// not by itself sufficient for regulated banking data.
import { NextRequest, NextResponse } from "next/server";
import { isAnalysisMode } from "@/lib/modes";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompts";
import { getModel } from "@/lib/openai";
import { runChatCompletion } from "@/lib/openaiChat";
import {
  buildSourceSearchQuery,
  categoriesForMode,
  searchLegalSources,
  formatSourcesBlock,
} from "@/lib/legalSources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 60_000;

interface AnalyzeBody {
  text?: unknown;
  mode?: unknown;
  additionalInstruction?: unknown;
}

export async function POST(req: NextRequest) {
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
  if (!isAnalysisMode(mode)) {
    return NextResponse.json(
      { error: "Не выбран корректный режим анализа." },
      { status: 400 },
    );
  }

  // Retrieve relevant legal sources from the knowledge base (degrades to none
  // if the DB is unavailable).
  const searchQuery = buildSourceSearchQuery({
    mode,
    documentText: text,
    extra: additionalInstruction,
  });
  const sources = await searchLegalSources(searchQuery, categoriesForMode(mode));
  const sourcesBlock = formatSourcesBlock(sources);

  const model = getModel();
  const userPrompt = buildUserPrompt({
    mode,
    text,
    additionalInstruction,
    sourcesBlock,
  });

  // Safe log: no document text, no API key.
  console.info(
    `[analyze] mode=${mode} textLength=${text.length} sources=${sources.length} model=${model}`,
  );

  const result = await runChatCompletion([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]);

  if (!result.ok) {
    console.error(
      `[analyze] error mode=${mode} textLength=${text.length} model=${model} status=${result.error.details.status} code=${result.error.details.code ?? "none"} message=${result.error.details.message ?? "none"}`,
    );
    return NextResponse.json(
      { error: result.error.friendly, details: result.error.details },
      { status: result.error.httpStatus },
    );
  }

  return NextResponse.json({ result: result.reply });
}

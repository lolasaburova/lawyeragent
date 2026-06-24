// POST /api/sessions  — create a session after the initial analysis.
// GET  /api/sessions  — list sessions (optional ?search= by title).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAnalysisMode } from "@/lib/modes";
import { generateSessionTitle } from "@/lib/sessionTitle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 60_000;

interface CreateBody {
  title?: unknown;
  documentText?: unknown;
  analysisMode?: unknown;
  initialAnalysis?: unknown;
}

export async function POST(req: NextRequest) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Ожидается JSON." }, { status: 400 });
  }

  const documentText =
    typeof body.documentText === "string" ? body.documentText : "";
  const initialAnalysis =
    typeof body.initialAnalysis === "string" ? body.initialAnalysis : "";
  const analysisMode = body.analysisMode;
  const rawTitle = typeof body.title === "string" ? body.title.trim() : "";

  if (!initialAnalysis.trim()) {
    return NextResponse.json(
      { error: "Нет первоначального анализа для сохранения." },
      { status: 400 },
    );
  }
  if (!isAnalysisMode(analysisMode)) {
    return NextResponse.json({ error: "Некорректный режим анализа." }, { status: 400 });
  }
  if (documentText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Текст документа слишком длинный." }, { status: 400 });
  }

  const title = rawTitle || generateSessionTitle(documentText);

  try {
    const session = await prisma.chatSession.create({
      data: { title, documentText, analysisMode, initialAnalysis },
    });
    return NextResponse.json({ session });
  } catch (err) {
    console.error(
      `[sessions:create] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json(
      { error: "Не удалось сохранить сессию. Проверьте подключение к базе данных." },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";

  try {
    const sessions = await prisma.chatSession.findMany({
      where: search
        ? { title: { contains: search, mode: "insensitive" } }
        : undefined,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        analysisMode: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 100,
    });
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error(
      `[sessions:list] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json(
      { error: "Не удалось загрузить список сессий.", sessions: [] },
      { status: 500 },
    );
  }
}

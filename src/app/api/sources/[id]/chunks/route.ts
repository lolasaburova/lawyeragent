// POST /api/sources/[id]/chunks — add a chunk to a source.
//
// MVP admin API. For production, protect with authentication and RBAC.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface ChunkBody {
  articleNumber?: unknown;
  clauseNumber?: unknown;
  heading?: unknown;
  text?: unknown;
  url?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: ChunkBody;
  try {
    body = (await req.json()) as ChunkBody;
  } catch {
    return NextResponse.json({ error: "Ожидается JSON." }, { status: 400 });
  }

  const text = asString(body.text);
  if (!text) {
    return NextResponse.json({ error: "Поле text обязательно." }, { status: 400 });
  }

  try {
    // Ensure the parent source exists.
    const source = await prisma.legalSource.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: "Источник не найден." }, { status: 404 });
    }

    const chunk = await prisma.legalSourceChunk.create({
      data: {
        sourceId: id,
        text,
        articleNumber: asString(body.articleNumber),
        clauseNumber: asString(body.clauseNumber),
        heading: asString(body.heading),
        url: asString(body.url),
      },
    });
    return NextResponse.json({ chunk });
  } catch (err) {
    console.error(
      `[chunks:create] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json({ error: "Не удалось добавить фрагмент." }, { status: 500 });
  }
}

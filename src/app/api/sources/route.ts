// GET  /api/sources — list legal sources (with chunk counts).
// POST /api/sources — create a legal source.
//
// MVP admin API. For production, protect with authentication and role-based
// access control.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateSourceBody {
  title?: unknown;
  jurisdiction?: unknown;
  category?: unknown;
  sourceType?: unknown;
  url?: unknown;
  language?: unknown;
  effectiveDate?: unknown;
  versionDate?: unknown;
  isActive?: unknown;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  try {
    const sources = await prisma.legalSource.findMany({
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });
    return NextResponse.json({ sources });
  } catch (err) {
    console.error(
      `[sources:list] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json(
      { error: "Не удалось загрузить источники.", sources: [] },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let body: CreateSourceBody;
  try {
    body = (await req.json()) as CreateSourceBody;
  } catch {
    return NextResponse.json({ error: "Ожидается JSON." }, { status: 400 });
  }

  const title = asString(body.title);
  const category = asString(body.category);
  const sourceType = asString(body.sourceType);
  if (!title || !category || !sourceType) {
    return NextResponse.json(
      { error: "Обязательны поля: title, category, sourceType." },
      { status: 400 },
    );
  }

  try {
    const source = await prisma.legalSource.create({
      data: {
        title,
        category,
        sourceType,
        jurisdiction: asString(body.jurisdiction),
        url: asString(body.url),
        language: asString(body.language),
        effectiveDate: asDate(body.effectiveDate),
        versionDate: asDate(body.versionDate),
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
      },
    });
    return NextResponse.json({ source });
  } catch (err) {
    console.error(
      `[sources:create] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json({ error: "Не удалось создать источник." }, { status: 500 });
  }
}

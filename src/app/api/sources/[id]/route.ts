// PATCH  /api/sources/[id] — edit title/url/category/sourceType, activate/deactivate.
// DELETE /api/sources/[id] — delete source (chunks cascade).
//
// MVP admin API. For production, protect with authentication and RBAC.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface PatchBody {
  title?: unknown;
  url?: unknown;
  category?: unknown;
  sourceType?: unknown;
  jurisdiction?: unknown;
  language?: unknown;
  isActive?: unknown;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Ожидается JSON." }, { status: 400 });
  }

  const data: Prisma.LegalSourceUpdateInput = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.url === "string") data.url = body.url.trim() || null;
  if (typeof body.category === "string" && body.category.trim()) data.category = body.category.trim();
  if (typeof body.sourceType === "string" && body.sourceType.trim()) data.sourceType = body.sourceType.trim();
  if (typeof body.jurisdiction === "string") data.jurisdiction = body.jurisdiction.trim() || null;
  if (typeof body.language === "string") data.language = body.language.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления." }, { status: 400 });
  }

  try {
    const source = await prisma.legalSource.update({ where: { id }, data });
    return NextResponse.json({ source });
  } catch (err) {
    console.error(
      `[sources:update] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json({ error: "Не удалось обновить источник." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.legalSource.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      `[sources:delete] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json({ error: "Не удалось удалить источник." }, { status: 500 });
  }
}

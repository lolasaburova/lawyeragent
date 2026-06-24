// GET    /api/sessions/[id]  — session + messages
// PATCH  /api/sessions/[id]  — rename title
// DELETE /api/sessions/[id]  — delete session (messages cascade)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) {
      return NextResponse.json({ error: "Сессия не найдена." }, { status: 404 });
    }
    const { messages, ...rest } = session;
    return NextResponse.json({ session: rest, messages });
  } catch (err) {
    console.error(
      `[sessions:get] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json({ error: "Ошибка базы данных." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body: { title?: unknown };
  try {
    body = (await req.json()) as { title?: unknown };
  } catch {
    return NextResponse.json({ error: "Ожидается JSON." }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Название не может быть пустым." }, { status: 400 });
  }
  try {
    const session = await prisma.chatSession.update({
      where: { id },
      data: { title },
    });
    return NextResponse.json({ session });
  } catch (err) {
    console.error(
      `[sessions:rename] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json({ error: "Не удалось переименовать сессию." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.chatSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      `[sessions:delete] db error: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return NextResponse.json({ error: "Не удалось удалить сессию." }, { status: 500 });
  }
}

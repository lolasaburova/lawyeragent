import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AnalysisMode, ANALYSIS_MODES } from "@/lib/modes";
import ResultView from "@/components/ResultView";
import ChatPanel, { ChatMessageItem } from "@/components/ChatPanel";

export const dynamic = "force-dynamic";

function modeLabel(value: string): string {
  return ANALYSIS_MODES.find((m) => m.value === value)?.label ?? value;
}

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let session;
  try {
    session = await prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  } catch {
    // DB unavailable — show a friendly message rather than crashing.
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Не удалось загрузить чат. Проверьте подключение к базе данных
          (DATABASE_URL) и выполненные миграции.
        </p>
      </div>
    );
  }

  if (!session) notFound();

  const initialMessages: ChatMessageItem[] = session.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-navy">
          {session.title}
        </h1>
        <p className="mt-1 text-xs text-gray-500">
          {modeLabel(session.analysisMode)} ·{" "}
          {new Date(session.createdAt).toLocaleString("ru-RU")}
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-navy">
          Первоначальный анализ
        </h2>
        <ResultView markdown={session.initialAnalysis} />
      </section>

      <ChatPanel
        documentText={session.documentText}
        analysisMode={session.analysisMode as AnalysisMode}
        initialAnalysis={session.initialAnalysis}
        sessionId={session.id}
        initialMessages={initialMessages}
      />
    </div>
  );
}

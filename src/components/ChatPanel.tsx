"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisMode } from "@/lib/modes";
import ResultView from "@/components/ResultView";

export interface ChatMessageItem {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  // Context snapshots (used in stateless mode and as fallback display).
  documentText: string;
  analysisMode: AnalysisMode;
  initialAnalysis: string;
  // True when current document/mode no longer match the analysis (stateless).
  stale?: boolean;
  // When set, the panel persists messages via /api/sessions/[id]/messages.
  sessionId?: string;
  // Preloaded messages (persistent mode).
  initialMessages?: ChatMessageItem[];
}

export default function ChatPanel({
  documentText,
  analysisMode,
  initialAnalysis,
  stale = false,
  sessionId,
  initialMessages,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageItem[]>(
    initialMessages ?? [],
  );
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState("");

  const endRef = useRef<HTMLDivElement>(null);
  const persistent = Boolean(sessionId);

  // Reset on a new (stateless) analysis. In persistent mode the message list is
  // owned by the loaded session, so we don't wipe it here.
  useEffect(() => {
    if (!persistent) {
      setMessages([]);
      setError("");
      setErrorDetails("");
    }
  }, [initialAnalysis, persistent]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  async function handleSend() {
    const q = question.trim();
    if (!q || loading) return;

    setError("");
    setErrorDetails("");
    setLoading(true);

    const history = messages;
    setMessages([...history, { role: "user", content: q }]);
    setQuestion("");

    try {
      const url = persistent
        ? `/api/sessions/${sessionId}/messages`
        : "/api/chat";
      const payload = persistent
        ? { question: q }
        : {
            documentText,
            analysisMode,
            initialAnalysis,
            messages: history,
            question: q,
          };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось получить ответ.");
        if (data.details) {
          const d = data.details;
          setErrorDetails(
            `status: ${d.status ?? "—"} · code: ${d.code ?? "—"} · type: ${
              d.type ?? "—"
            }${d.message ? ` · ${d.message}` : ""}`,
          );
        }
        setMessages(history); // roll back optimistic message
        setQuestion(q);
        return;
      }

      if (persistent && Array.isArray(data.messages)) {
        // DB is authoritative in persistent mode.
        setMessages(
          data.messages.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        );
      } else {
        setMessages([
          ...history,
          { role: "user", content: q },
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch {
      setError("Сетевая ошибка. Проверьте соединение и попробуйте снова.");
      setMessages(history);
      setQuestion(q);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    // Clears the on-screen list. In persistent mode the stored history remains
    // in the database (delete the whole chat from the sidebar to remove it).
    setMessages([]);
    setError("");
    setErrorDetails("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy">
          Задать вопрос по анализу
        </h2>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-red-300 hover:text-red-600"
          >
            Очистить чат
          </button>
        )}
      </div>

      {stale && (
        <div className="mt-3 rounded-md border border-gold/50 bg-gold/10 px-4 py-2.5 text-xs leading-relaxed text-gray-700">
          Документ или режим анализа изменён. Для корректного чата рекомендуется
          выполнить анализ заново.
        </div>
      )}

      {messages.length > 0 && (
        <div className="mt-4 space-y-3">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-navy px-3.5 py-2.5 text-sm text-white">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="max-w-[92%] rounded-lg rounded-bl-sm border border-gray-200 bg-gray-50 px-3.5 py-2.5">
                  <ResultView markdown={m.content} />
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
      )}

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-gold" />
          AI готовит ответ…
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {errorDetails && (
            <p className="mt-1.5 break-words font-mono text-xs text-red-500">
              {errorDetails}
            </p>
          )}
        </div>
      )}

      <div className="mt-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Например: объясни риск по частичному твердому обязательству; дай редакцию пункта; подготовь короткий комментарий коллегам; какие нормы нужно проверить?"
          className="w-full resize-y rounded-md border border-gray-300 p-3 text-sm text-gray-800 shadow-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-400">Ctrl/⌘ + Enter — отправить</span>
          <button
            onClick={handleSend}
            disabled={loading || !question.trim()}
            className="rounded-md bg-navy px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Отправка…" : "Отправить вопрос"}
          </button>
        </div>
      </div>
    </section>
  );
}

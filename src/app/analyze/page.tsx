"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ANALYSIS_MODES, AnalysisMode } from "@/lib/modes";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import ResultView from "@/components/ResultView";
import ChatPanel from "@/components/ChatPanel";
import { SESSIONS_CHANGED_EVENT } from "@/components/Sidebar";

export default function AnalyzePage() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<AnalysisMode>(ANALYSIS_MODES[0].value);
  const [instruction, setInstruction] = useState("");

  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Snapshots of the document text and mode used for the current analysis,
  // so the chat keeps the right context even if the inputs change afterwards.
  const [analyzedText, setAnalyzedText] = useState("");
  const [analyzedMode, setAnalyzedMode] = useState<AnalysisMode>(
    ANALYSIS_MODES[0].value,
  );
  // The persistent chat session created after the analysis (if the DB is up).
  const [sessionId, setSessionId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // The chat context is stale if the user changed the document or mode since
  // the analysis was produced.
  const chatStale =
    result !== "" && (text !== analyzedText || mode !== analyzedMode);

  const activeMode = ANALYSIS_MODES.find((m) => m.value === mode);

  async function handleFile(file: File) {
    setError("");
    setNotice("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось обработать файл.");
        return;
      }
      if (data.note) setNotice(data.note);
      if (data.text) {
        setText(data.text);
      } else if (data.needsManualPaste) {
        setNotice(
          data.note ||
            "Автоматически извлечь текст не удалось. Вставьте текст вручную.",
        );
      }
    } catch {
      setError("Ошибка загрузки файла. Попробуйте ещё раз или вставьте текст вручную.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAnalyze() {
    setError("");
    setErrorDetails("");
    setNotice("");
    setResult("");
    setCopied(false);

    if (!text.trim()) {
      setError("Вставьте текст документа или загрузите файл.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          mode,
          additionalInstruction: instruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось выполнить анализ.");
        if (data.details) {
          const d = data.details;
          setErrorDetails(
            `status: ${d.status ?? "—"} · code: ${d.code ?? "—"} · type: ${
              d.type ?? "—"
            }${d.message ? ` · ${d.message}` : ""}`,
          );
        }
        return;
      }
      setResult(data.result);
      // Snapshot the exact inputs this analysis was based on (for chat context).
      setAnalyzedText(text);
      setAnalyzedMode(mode);
      setSessionId(null);
      // Persist a chat session (best-effort: if the DB is down, the analysis
      // still works in stateless mode).
      void createSession(text, mode, data.result, instruction);
    } catch {
      setError("Сетевая ошибка. Проверьте соединение и попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }

  async function createSession(
    documentText: string,
    analysisMode: AnalysisMode,
    initialAnalysis: string,
    initialInstruction: string,
  ) {
    try {
      const title = initialInstruction.trim()
        ? initialInstruction.trim().split(/\s+/).slice(0, 10).join(" ")
        : "";
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          documentText,
          analysisMode,
          initialAnalysis,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.session?.id) {
        setSessionId(data.session.id);
        // Let the sidebar refresh its list.
        window.dispatchEvent(new Event(SESSIONS_CHANGED_EVENT));
      }
    } catch {
      // Persistence is best-effort in the MVP; ignore failures here.
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать. Выделите текст вручную.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy">
          Анализ документа
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Вставьте текст или загрузите файл (TXT, DOCX, PDF), выберите режим и
          получите структурированный анализ.
        </p>
      </div>

      <div className="mb-6">
        <DisclaimerBanner />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: input & settings */}
        <section className="space-y-5">
          <div
            id="upload"
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
          >
            <label className="mb-2 block text-sm font-semibold text-navy">
              1. Документ
            </label>

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="block w-full text-sm text-gray-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-navy-light"
              />
              {uploading && (
                <span className="text-xs text-gray-500">Обработка файла…</span>
              )}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              placeholder="Вставьте сюда текст договора или другого документа…"
              className="w-full resize-y rounded-md border border-gray-300 p-3 text-sm text-gray-800 shadow-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {text.length.toLocaleString("ru-RU")} симв.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <label
              htmlFor="mode"
              className="mb-2 block text-sm font-semibold text-navy"
            >
              2. Режим анализа
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as AnalysisMode)}
              className="w-full rounded-md border border-gray-300 bg-white p-2.5 text-sm text-gray-800 shadow-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            >
              {ANALYSIS_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {activeMode && (
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                {activeMode.description}
              </p>
            )}

            <label
              htmlFor="instruction"
              className="mb-2 mt-4 block text-sm font-semibold text-navy"
            >
              3. Дополнительный вопрос / инструкция (необязательно)
            </label>
            <textarea
              id="instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              placeholder="Например: обратите особое внимание на пункт об ответственности сторон."
              className="w-full resize-y rounded-md border border-gray-300 p-3 text-sm text-gray-800 shadow-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>

          <p className="text-xs leading-relaxed text-gray-500">
            Не загружайте документы с банковской или иной охраняемой законом
            тайной без согласования со службой комплаенс. Текст передаётся в
            OpenAI для анализа; полный текст не логируется и не сохраняется после
            обработки.
          </p>

          <button
            onClick={handleAnalyze}
            disabled={loading || uploading}
            className="w-full rounded-md bg-navy px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Анализ выполняется…" : "Проанализировать"}
          </button>
        </section>

        {/* RIGHT: result */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">Результат анализа</h2>
            {result && (
              <button
                onClick={handleCopy}
                className="rounded-md border border-navy px-3 py-1.5 text-xs font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
              >
                {copied ? "Скопировано ✓" : "Скопировать результат"}
              </button>
            )}
          </div>

          <div className="min-h-[28rem] rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p>{error}</p>
                {errorDetails && (
                  <p className="mt-1.5 break-words font-mono text-xs text-red-500">
                    {errorDetails}
                  </p>
                )}
              </div>
            )}
            {notice && !error && (
              <div className="mb-3 rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-gray-700">
                {notice}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span className="h-3 w-3 animate-pulse rounded-full bg-gold" />
                Модель анализирует документ. Это может занять до минуты…
              </div>
            )}

            {!loading && !result && !error && (
              <p className="text-sm text-gray-400">
                Здесь появится структурированный анализ после нажатия кнопки
                «Проанализировать».
              </p>
            )}

            {result && <ResultView markdown={result} />}
          </div>

          <p className="text-xs text-gray-400">
            <Link href="/disclaimer" className="underline">
              Ограничения и дисклеймер
            </Link>
          </p>
        </section>
      </div>

      {/* Follow-up chat — only after the initial analysis is completed. */}
      {result && (
        <ChatPanel
          documentText={analyzedText}
          analysisMode={analyzedMode}
          initialAnalysis={result}
          stale={chatStale}
          sessionId={sessionId ?? undefined}
        />
      )}
    </div>
  );
}

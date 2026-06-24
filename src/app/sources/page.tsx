"use client";

// Sources admin (MVP). For production, protect this page with authentication
// and role-based access control (admin only).

import { useCallback, useEffect, useState } from "react";

interface SourceItem {
  id: string;
  title: string;
  jurisdiction: string | null;
  category: string;
  sourceType: string;
  url: string | null;
  language: string | null;
  isActive: boolean;
  updatedAt: string;
  _count?: { chunks: number };
}

const CATEGORIES = [
  "civil_law","banking","central_bank","securities","currency_regulation",
  "aml_cft","personal_data","commercial_secret","banking_secret",
  "islamic_finance","shariah_standard","internal_policy",
];
const SOURCE_TYPES = [
  "law","regulation","presidential_decree","cabinet_resolution",
  "central_bank_regulation","capital_market_regulation","shariah_standard",
  "internal_document","uploaded_source",
];

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // New-source form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [sourceType, setSourceType] = useState(SOURCE_TYPES[0]);
  const [url, setUrl] = useState("");
  const [jurisdiction, setJurisdiction] = useState("UZ");
  const [language, setLanguage] = useState("ru");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setError(res.ok ? "" : data.error || "Ошибка загрузки.");
    } catch {
      setError("Не удалось загрузить источники (проверьте DATABASE_URL).");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category, sourceType, url, jurisdiction, language }),
    });
    if (res.ok) {
      setTitle("");
      setUrl("");
      load();
    } else {
      const d = await res.json();
      setError(d.error || "Не удалось создать источник.");
    }
  }

  async function toggleActive(s: SourceItem) {
    await fetch(`/api/sources/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    load();
  }

  async function editSource(s: SourceItem) {
    const newTitle = prompt("Название:", s.title);
    if (newTitle === null) return;
    const newUrl = prompt("URL:", s.url ?? "");
    if (newUrl === null) return;
    const newCategory = prompt(`Категория (${CATEGORIES.join(", ")}):`, s.category);
    if (newCategory === null) return;
    await fetch(`/api/sources/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle, url: newUrl, category: newCategory }),
    });
    load();
  }

  async function deleteSource(s: SourceItem) {
    if (!confirm(`Удалить источник «${s.title}» и его фрагменты?`)) return;
    await fetch(`/api/sources/${s.id}`, { method: "DELETE" });
    load();
  }

  async function addChunk(s: SourceItem, form: HTMLFormElement) {
    const fd = new FormData(form);
    const payload = {
      articleNumber: fd.get("articleNumber"),
      clauseNumber: fd.get("clauseNumber"),
      heading: fd.get("heading"),
      text: fd.get("text"),
      url: fd.get("url"),
    };
    if (!String(payload.text || "").trim()) return;
    const res = await fetch(`/api/sources/${s.id}/chunks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      form.reset();
      load();
    } else {
      const d = await res.json();
      setError(d.error || "Не удалось добавить фрагмент.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-navy">
        База юридических источников
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Добавляйте источники и их фрагменты (статьи / пункты). AI цитирует только
        активные источники из этой базы.
      </p>
      <p className="mt-2 rounded-md border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-gray-600">
        MVP-страница без аутентификации. Для продакшена защитите её авторизацией
        и ролевым доступом (только администратор).
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* New source */}
      <form
        onSubmit={addSource}
        className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold text-navy">Новый источник</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название (например: Закон «О банках и банковской деятельности»)"
            className="rounded-md border border-gray-300 p-2 text-sm sm:col-span-2"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-gray-300 p-2 text-sm">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="rounded-md border border-gray-300 p-2 text-sm">
            {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (необязательно)" className="rounded-md border border-gray-300 p-2 text-sm" />
          <input value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="Юрисдикция" className="rounded-md border border-gray-300 p-2 text-sm" />
          <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Язык (ru / uz-latn / uz-cyrl / en)" className="rounded-md border border-gray-300 p-2 text-sm" />
        </div>
        <button type="submit" className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">
          Добавить источник
        </button>
      </form>

      {/* List */}
      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
        {!loading && sources.length === 0 && (
          <p className="text-sm text-gray-500">Источников пока нет.</p>
        )}
        {sources.map((s) => (
          <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-navy">
                  {s.title}{" "}
                  {!s.isActive && (
                    <span className="ml-1 rounded bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-600">
                      выключен
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {s.category} · {s.sourceType}
                  {s.jurisdiction ? ` · ${s.jurisdiction}` : ""} ·{" "}
                  {s._count?.chunks ?? 0} фрагм.
                  {s.url ? (
                    <>
                      {" · "}
                      <a href={s.url} target="_blank" rel="noreferrer" className="text-navy underline">
                        ссылка
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex gap-1 text-xs">
                <button onClick={() => toggleActive(s)} className="rounded border border-gray-300 px-2 py-1 hover:border-gold">
                  {s.isActive ? "Выключить" : "Включить"}
                </button>
                <button onClick={() => editSource(s)} className="rounded border border-gray-300 px-2 py-1 hover:border-gold">
                  Изменить
                </button>
                <button onClick={() => deleteSource(s)} className="rounded border border-gray-300 px-2 py-1 text-red-600 hover:border-red-300">
                  Удалить
                </button>
              </div>
            </div>

            {/* Add chunk */}
            <form
              onSubmit={(e) => { e.preventDefault(); addChunk(s, e.currentTarget); }}
              className="mt-3 border-t border-gray-100 pt-3"
            >
              <div className="grid gap-2 sm:grid-cols-4">
                <input name="articleNumber" placeholder="Статья" className="rounded-md border border-gray-300 p-2 text-xs" />
                <input name="clauseNumber" placeholder="Пункт" className="rounded-md border border-gray-300 p-2 text-xs" />
                <input name="heading" placeholder="Заголовок" className="rounded-md border border-gray-300 p-2 text-xs sm:col-span-2" />
                <input name="url" placeholder="URL фрагмента (необязательно)" className="rounded-md border border-gray-300 p-2 text-xs sm:col-span-4" />
                <textarea name="text" rows={2} placeholder="Текст фрагмента (норма/статья)…" className="rounded-md border border-gray-300 p-2 text-xs sm:col-span-4" />
              </div>
              <button type="submit" className="mt-2 rounded-md border border-navy px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy hover:text-white">
                + Добавить фрагмент
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

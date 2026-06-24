"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ANALYSIS_MODES } from "@/lib/modes";

interface SessionListItem {
  id: string;
  title: string;
  analysisMode: string;
  createdAt: string;
  updatedAt: string;
}

function modeLabel(value: string): string {
  return ANALYSIS_MODES.find((m) => m.value === value)?.label ?? value;
}

// Other components can dispatch this to make the sidebar refresh its list.
export const SESSIONS_CHANGED_EVENT = "sessions:changed";

export default function Sidebar() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbError, setDbError] = useState(false);
  const pathname = usePathname();

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/sessions${q ? `?search=${encodeURIComponent(q)}` : ""}`,
      );
      const data = await res.json();
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      setDbError(!res.ok);
    } catch {
      setDbError(true);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  // Refresh on external changes (new analysis, delete elsewhere) and on nav.
  useEffect(() => {
    const handler = () => load(search);
    window.addEventListener(SESSIONS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SESSIONS_CHANGED_EVENT, handler);
  }, [load, search]);

  useEffect(() => {
    load(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function handleDelete(id: string) {
    if (!confirm("Удалить этот чат и его историю?")) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setSessions((s) => s.filter((x) => x.id !== id));
    if (pathname === `/chat/${id}`) window.location.href = "/";
  }

  async function handleRename(id: string, current: string) {
    const title = prompt("Новое название чата:", current);
    if (!title || !title.trim()) return;
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setSessions((s) =>
      s.map((x) => (x.id === id ? { ...x, title: title.trim() } : x)),
    );
  }

  return (
    <aside className="flex h-full w-72 flex-col border-r border-gray-200 bg-navy text-white">
      <div className="p-3">
        <Link
          href="/analyze"
          className="block w-full rounded-md bg-gold px-4 py-2.5 text-center text-sm font-semibold text-navy transition-colors hover:bg-gold-light"
        >
          + Новый анализ
        </Link>
      </div>

      <div className="px-3 pb-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию чата…"
          className="w-full rounded-md border border-navy-light bg-navy-light px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:border-gold focus:outline-none"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {dbError && (
          <p className="px-2 py-3 text-xs leading-relaxed text-gray-300">
            История недоступна. Проверьте, что задан DATABASE_URL и выполнены
            миграции Prisma.
          </p>
        )}
        {!dbError && !loading && sessions.length === 0 && (
          <p className="px-2 py-3 text-xs text-gray-400">
            Пока нет сохранённых анализов.
          </p>
        )}
        <ul className="space-y-1">
          {sessions.map((s) => {
            const active = pathname === `/chat/${s.id}`;
            return (
              <li key={s.id}>
                <div
                  className={`group flex items-center gap-1 rounded-md px-2 py-2 transition-colors ${
                    active ? "bg-navy-light" : "hover:bg-navy-light/60"
                  }`}
                >
                  <Link href={`/chat/${s.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{s.title}</span>
                    <span className="block truncate text-[11px] text-gray-400">
                      {modeLabel(s.analysisMode)} ·{" "}
                      {new Date(s.updatedAt).toLocaleDateString("ru-RU")}
                    </span>
                  </Link>
                  <button
                    onClick={() => handleRename(s.id, s.title)}
                    title="Переименовать"
                    className="hidden rounded p-1 text-gray-300 hover:text-gold group-hover:block"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    title="Удалить"
                    className="hidden rounded p-1 text-gray-300 hover:text-red-400 group-hover:block"
                  >
                    🗑
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-navy-light p-3 text-xs">
        <Link href="/sources" className="text-gray-300 hover:text-gold">
          База источников
        </Link>
      </div>
    </aside>
  );
}

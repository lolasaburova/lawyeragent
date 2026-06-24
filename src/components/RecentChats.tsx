"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ANALYSIS_MODES } from "@/lib/modes";

interface Item {
  id: string;
  title: string;
  analysisMode: string;
  updatedAt: string;
}

function modeLabel(v: string) {
  return ANALYSIS_MODES.find((m) => m.value === v)?.label ?? v;
}

// Compact recent-chats list with title search, shown on the home page (useful
// on mobile where the sidebar is hidden).
export default function RecentChats() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/sessions${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        );
        const data = await res.json();
        setItems(Array.isArray(data.sessions) ? data.sessions.slice(0, 8) : []);
      } catch {
        setItems([]);
      } finally {
        setReady(true);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  if (ready && items.length === 0 && !search) return null;

  return (
    <div className="mt-12 rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-navy">Недавние анализы</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию чата…"
          className="w-48 rounded-md border border-gray-300 px-3 py-1.5 text-xs focus:border-navy focus:outline-none"
        />
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">Ничего не найдено.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((s) => (
            <li key={s.id}>
              <Link
                href={`/chat/${s.id}`}
                className="flex items-center justify-between gap-3 py-2 hover:bg-gray-50"
              >
                <span className="min-w-0 truncate text-sm text-navy">
                  {s.title}
                </span>
                <span className="shrink-0 text-[11px] text-gray-400">
                  {modeLabel(s.analysisMode)} ·{" "}
                  {new Date(s.updatedAt).toLocaleDateString("ru-RU")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

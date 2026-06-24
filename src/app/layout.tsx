import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Legal & Shariah AI Agent",
  description:
    "AI-помощник для юридического анализа документов по законодательству Республики Узбекистан и анализа документов по исламскому банкингу.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="flex h-screen flex-col overflow-hidden bg-white font-sans text-navy antialiased">
        <header className="shrink-0 border-b border-gray-200 bg-navy text-white">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg font-bold text-gold">§</span>
              <span className="text-base font-semibold tracking-tight">
                Legal &amp; Shariah AI Agent
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/analyze" className="transition-colors hover:text-gold">
                Анализ
              </Link>
              <Link href="/sources" className="transition-colors hover:text-gold">
                Источники
              </Link>
              <Link
                href="/disclaimer"
                className="transition-colors hover:text-gold"
              >
                Дисклеймер
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar is hidden on small screens to keep mobile usable. */}
          <div className="hidden md:block">
            <Sidebar />
          </div>

          <main className="flex-1 overflow-y-auto">
            <div className="border-b border-gold/30 bg-gold/5 px-4 py-2 text-center text-xs leading-relaxed text-gray-700">
              История анализов сохраняется в базе данных. Не загружайте
              банковскую тайну, персональные данные или коммерческую тайну без
              разрешения.
            </div>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

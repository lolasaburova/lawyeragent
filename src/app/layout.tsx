import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
      <body className="min-h-screen bg-white font-sans text-navy antialiased flex flex-col">
        <header className="border-b border-gray-200 bg-navy text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-gold text-lg font-bold">§</span>
              <span className="text-base font-semibold tracking-tight">
                Legal &amp; Shariah AI Agent
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/analyze" className="hover:text-gold transition-colors">
                Анализ
              </Link>
              <Link
                href="/disclaimer"
                className="hover:text-gold transition-colors"
              >
                Дисклеймер
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-gray-200 bg-gray-50">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-gray-500">
            <p>
              Ответы AI-агента носят справочно-аналитический характер и не
              являются юридическим заключением или решением шариатского совета.{" "}
              <Link href="/disclaimer" className="text-navy underline">
                Подробнее
              </Link>
              .
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

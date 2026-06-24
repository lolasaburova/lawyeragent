// Legal knowledge-base retrieval (MVP: simple ILIKE keyword search).
//
// Vector/RAG search can replace `searchLegalSources` later without changing the
// callers — they only depend on the RetrievedChunk shape and the formatted block.

import { prisma } from "@/lib/prisma";
import { AnalysisMode } from "@/lib/modes";

export interface RetrievedChunk {
  sourceTitle: string;
  category: string;
  sourceType: string;
  articleNumber: string | null;
  clauseNumber: string | null;
  heading: string | null;
  text: string;
  url: string | null;
  versionDate: string | null; // ISO date string if available
}

// Which source categories are most relevant for each analysis mode. Used to
// bias the search; when empty, all categories are searched.
const MODE_CATEGORIES: Record<AnalysisMode, string[]> = {
  [AnalysisMode.UzbekLegal]: [
    "civil_law",
    "banking",
    "securities",
    "currency_regulation",
    "personal_data",
    "commercial_secret",
    "aml_cft",
    "internal_policy",
  ],
  [AnalysisMode.BankingLegal]: [
    "banking",
    "central_bank",
    "securities",
    "currency_regulation",
    "aml_cft",
    "banking_secret",
    "personal_data",
    "commercial_secret",
    "internal_policy",
  ],
  [AnalysisMode.Shariah]: ["islamic_finance", "shariah_standard"],
  [AnalysisMode.IslamicBankingProduct]: [
    "islamic_finance",
    "shariah_standard",
    "banking",
    "securities",
  ],
  [AnalysisMode.ClauseComment]: [],
  [AnalysisMode.ClauseRedraft]: [],
};

export function categoriesForMode(mode: AnalysisMode): string[] {
  return MODE_CATEGORIES[mode] ?? [];
}

// Very small multilingual stopword set — enough to drop noise from the query.
const STOPWORDS = new Set([
  "и","в","во","не","что","он","на","я","с","со","как","а","то","все","она",
  "так","его","но","да","ты","к","у","же","вы","за","бы","по","только","ее",
  "мне","было","вот","от","меня","о","из","ему","для","или","при","об","до",
  "the","a","an","of","to","and","in","on","for","is","are","be","or","by",
]);

/**
 * Build a compact keyword query from the analysis context. We deliberately do
 * NOT send the whole document — only distinctive keywords — to keep the ILIKE
 * search cheap and avoid logging/transmitting more than needed.
 */
export function buildSourceSearchQuery(params: {
  mode: AnalysisMode;
  documentText?: string;
  extra?: string;
}): string {
  const { documentText = "", extra = "" } = params;
  // Prefer the explicit instruction/question; fall back to the document head.
  const basis = `${extra} ${documentText.slice(0, 1200)}`;
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const raw of basis.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const w = raw.trim();
    if (w.length < 4 || STOPWORDS.has(w) || seen.has(w)) continue;
    seen.add(w);
    keywords.push(w);
    if (keywords.length >= 25) break;
  }
  return keywords.join(" ");
}

/**
 * MVP keyword search over active legal sources using case-insensitive ILIKE.
 * Returns the most relevant chunks (matched on chunk text/heading or source
 * title). `categories` narrows by LegalSource.category; `limit` caps results.
 */
export async function searchLegalSources(
  query: string,
  categories?: string[],
  limit = 6,
): Promise<RetrievedChunk[]> {
  const terms = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .slice(0, 20);

  if (terms.length === 0) return [];

  // OR across terms, each term matched against chunk text/heading or source title.
  const or = terms.flatMap((term) => [
    { text: { contains: term, mode: "insensitive" as const } },
    { heading: { contains: term, mode: "insensitive" as const } },
    {
      source: {
        is: { title: { contains: term, mode: "insensitive" as const } },
      },
    },
  ]);

  const sourceWhere: {
    isActive: boolean;
    category?: { in: string[] };
  } = { isActive: true };
  if (categories && categories.length > 0) {
    sourceWhere.category = { in: categories };
  }

  let chunks;
  try {
    chunks = await prisma.legalSourceChunk.findMany({
      where: { source: { is: sourceWhere }, OR: or },
      include: { source: true },
      take: limit,
      orderBy: { updatedAt: "desc" },
    });
  } catch (err) {
    // If the DB is unavailable, degrade gracefully to "no sources" rather than
    // failing the whole analysis. We log only the error name, never content.
    console.error(
      `[legalSources] search failed: ${err instanceof Error ? err.name : "unknown"}`,
    );
    return [];
  }

  return chunks.map((c) => ({
    sourceTitle: c.source.title,
    category: c.source.category,
    sourceType: c.source.sourceType,
    articleNumber: c.articleNumber,
    clauseNumber: c.clauseNumber,
    heading: c.heading,
    text: c.text,
    url: c.url ?? c.source.url,
    versionDate: c.source.versionDate
      ? c.source.versionDate.toISOString().slice(0, 10)
      : null,
  }));
}

/**
 * Format retrieved chunks as an "Available legal sources" block for the model
 * prompt. Returns an empty string when there are none, so callers can decide
 * how to instruct the model.
 */
export function formatSourcesBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const items = chunks.map((c, i) => {
    const ref = [
      c.articleNumber ? `ст. ${c.articleNumber}` : null,
      c.clauseNumber ? `п. ${c.clauseNumber}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const head = [
      `[${i + 1}] ${c.sourceTitle}`,
      ref ? ` (${ref})` : "",
      c.versionDate ? ` — ред. от ${c.versionDate}` : "",
    ].join("");
    const url = c.url ? `\nURL: ${c.url}` : "";
    // Cap the excerpt to keep the prompt small.
    const excerpt = c.text.length > 700 ? `${c.text.slice(0, 700)}…` : c.text;
    return `${head}${url}\nФрагмент: ${excerpt}`;
  });
  return items.join("\n\n");
}

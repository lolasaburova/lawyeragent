// Helpers for validating and converting follow-up chat history. Shared by
// /api/chat and /api/sessions/[id]/messages.
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY_MESSAGES = 20; // bound the prompt size.

/** Validate untrusted message arrays down to recent user/assistant turns. */
export function sanitizeHistory(raw: unknown): HistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryMessage[] = [];
  for (const m of raw) {
    if (
      m &&
      typeof m === "object" &&
      typeof (m as { content?: unknown }).content === "string"
    ) {
      const role = (m as { role?: unknown }).role;
      const content = (m as { content: string }).content;
      if ((role === "user" || role === "assistant") && content.trim()) {
        out.push({ role, content });
      }
    }
  }
  return out.slice(-MAX_HISTORY_MESSAGES);
}

/** Narrow roles to literals so they satisfy ChatCompletionMessageParam. */
export function toMessageParams(
  history: HistoryMessage[],
): ChatCompletionMessageParam[] {
  return history.map((m) =>
    m.role === "user"
      ? { role: "user" as const, content: m.content }
      : { role: "assistant" as const, content: m.content },
  );
}

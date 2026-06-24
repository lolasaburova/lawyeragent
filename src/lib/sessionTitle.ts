// Local (cheap, fast) chat-session title generation from the document text.
// We deliberately avoid an extra OpenAI call here for the MVP.
export function generateSessionTitle(documentText: string): string {
  const words = documentText.trim().split(/\s+/).filter(Boolean).slice(0, 12);
  let title = words.join(" ");
  if (title.length > 80) title = `${title.slice(0, 80).trim()}…`;
  return title || "Анализ документа";
}

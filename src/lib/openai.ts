import OpenAI from "openai";

// Default model. Overridable via OPENAI_MODEL env var so the model can be
// upgraded without code changes.
export const DEFAULT_MODEL = "gpt-4o-mini";

export function getModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

/**
 * Returns whether the OpenAI API key is configured. We never expose the key
 * itself to the caller — only a boolean — so it cannot leak.
 */
export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
}

// Lazily-created singleton so we don't throw at import time when the key is
// missing (the API route handles the missing-key case with a friendly message).
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

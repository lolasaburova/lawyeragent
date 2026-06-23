// Server-side document text extraction for TXT, DOCX and PDF.
//
// SECURITY: This module intentionally NEVER logs the extracted document text.
// We only ever log lengths / error types, never content. See /api/extract.

import mammoth from "mammoth";
// Import the lib entry point directly: pdf-parse's package index runs sample
// code on import, which we must avoid in a serverless build.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const SUPPORTED_EXTENSIONS = [".txt", ".docx", ".pdf"] as const;

export interface ExtractResult {
  text: string;
  // True when we could not reliably extract text and the user should paste it
  // manually (e.g. scanned PDFs without a text layer).
  needsManualPaste?: boolean;
  note?: string;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

async function extractDocx(buffer: Buffer): Promise<ExtractResult> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value ?? "" };
}

async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  // If parsing fails or yields no text (e.g. a scanned PDF), fall back to
  // asking the user to paste the text manually.
  try {
    const parsed = await pdfParse(buffer);
    const text = (parsed.text ?? "").trim();
    if (!text) {
      return {
        text: "",
        needsManualPaste: true,
        note: "Не удалось извлечь текст из PDF (возможно, это скан). Вставьте текст вручную.",
      };
    }
    return { text };
  } catch {
    return {
      text: "",
      needsManualPaste: true,
      note: "Не удалось обработать PDF автоматически. Вставьте текст документа вручную.",
    };
  }
}

export async function extractText(
  filename: string,
  buffer: Buffer,
): Promise<ExtractResult> {
  const ext = getExtension(filename);

  switch (ext) {
    case ".txt":
      return { text: buffer.toString("utf-8") };
    case ".docx":
      return extractDocx(buffer);
    case ".pdf":
      return extractPdf(buffer);
    default:
      throw new Error(
        `Неподдерживаемый формат файла: ${ext || "неизвестно"}. Поддерживаются: TXT, DOCX, PDF.`,
      );
  }
}

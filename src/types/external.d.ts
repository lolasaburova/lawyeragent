// Ambient type declarations for server-side document parsers that do not ship
// their own TypeScript types for the entry points we use.

declare module "mammoth" {
  interface ExtractRawTextOptions {
    buffer?: Buffer;
    path?: string;
  }
  interface ExtractResult {
    value: string;
    messages: unknown[];
  }
  export function extractRawText(
    options: ExtractRawTextOptions,
  ): Promise<ExtractResult>;
  const _default: {
    extractRawText(options: ExtractRawTextOptions): Promise<ExtractResult>;
  };
  export default _default;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}

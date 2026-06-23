"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders the AI result as Markdown (supports GFM tables, which the analysis
// modes rely on). Isolated in its own client component so the markdown libs
// are only loaded where needed.
export default function ResultView({ markdown }: { markdown: string }) {
  return (
    <div className="result-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

// Analysis modes for the Legal & Shariah AI Agent.
// Adding a new mode = add an entry here + a prompt block in prompts.ts.

export enum AnalysisMode {
  UzbekLegal = "uzbek_legal_analysis",
  BankingLegal = "banking_legal_analysis",
  Shariah = "shariah_analysis",
  IslamicBankingProduct = "islamic_banking_product_analysis",
  ClauseComment = "clause_comment",
  ClauseRedraft = "clause_redraft",
}

export interface AnalysisModeInfo {
  value: AnalysisMode;
  label: string;
  description: string;
}

// Ordered list used to render the dropdown on the /analyze page.
export const ANALYSIS_MODES: AnalysisModeInfo[] = [
  {
    value: AnalysisMode.UzbekLegal,
    label: "Юридический анализ (Республика Узбекистан)",
    description:
      "Общий юридический анализ документа по законодательству Республики Узбекистан.",
  },
  {
    value: AnalysisMode.BankingLegal,
    label: "Банковский юридический анализ",
    description:
      "Юридический анализ с акцентом на банковскую тайну, ЦБ РУз, AML/CFT, валютное регулирование.",
  },
  {
    value: AnalysisMode.Shariah,
    label: "Шариатский анализ",
    description:
      "Анализ структуры сделки на предмет соответствия нормам шариата (риба, гарар, майсир и др.).",
  },
  {
    value: AnalysisMode.IslamicBankingProduct,
    label: "Анализ исламского банковского продукта",
    description:
      "Анализ конкретного исламского продукта: мурабаха, иджара, мушарака, сукук и др.",
  },
  {
    value: AnalysisMode.ClauseComment,
    label: "Краткий комментарий к пункту",
    description: "Короткий деловой комментарий, который можно вставить в письмо.",
  },
  {
    value: AnalysisMode.ClauseRedraft,
    label: "Новая редакция пункта",
    description: "Предложение новой редакции пункта с объяснением проблемы.",
  },
];

export function isAnalysisMode(value: unknown): value is AnalysisMode {
  return (
    typeof value === "string" &&
    (Object.values(AnalysisMode) as string[]).includes(value)
  );
}

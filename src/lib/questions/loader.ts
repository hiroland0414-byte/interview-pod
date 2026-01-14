// src/lib/questions/loader.ts
import Papa from "papaparse";

export type ModeTag = "A1" | "A2" | "B" | "C";

type CoreCsvRow = {
  id: string;
  section?: string;
  question: string;
  hint?: string;
  depth1?: string;
  depth2?: string;
  depth3?: string;
  depth4?: string;
  depth5?: string;
  order?: string;
  notes?: string;
};

type AdditionalCsvRow = {
  id: string;
  question: string;
  hint?: string;
  depth_followup?: string;
  A1?: string;
  A2?: string;
  B?: string;
  C?: string;
  difficulty?: string;
  tags?: string;
  notes?: string;
};

// ✅ selector.ts が import している名前に合わせる（型だけの別名）
export type AdditionalQ = AdditionalCsvRow;

export type QuestionKind =
  | "core"
  | "core-depth"
  | "additional"
  | "additional-depth";

export type QuestionItem = {
  id: string;
  text: string;
  kind: QuestionKind;
  isMainCore?: boolean; // 3大質問（志望動機／自己PR／学チカ）の本体だけ true
  parentId?: string;
  section?: string;
  order: number;
};

// src/lib/interview/deepDive/loadCsvFallback.ts
import type { QuestionType } from "./rules";

export type CsvFallbackRow = {
  type: QuestionType;
  priority: number;
  tag: string;
  question: string;
};

function parseCsv(text: string): CsvFallbackRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  // 1行目ヘッダ
  const header = lines[0].split(",").map((s) => s.trim());
  const idx = (name: string) => header.indexOf(name);

  const iType = idx("type");
  const iPriority = idx("priority");
  const iTag = idx("tag");
  const iQuestion = idx("question");

  const rows: CsvFallbackRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // カンマを含むケースを最小限に守る（ダブルクォート対応は簡易）
    const raw = lines[i];

    // 簡易CSV分割（"..."内のカンマを許容）
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let k = 0; k < raw.length; k++) {
      const ch = raw[k];
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);

    const type = (cells[iType] || "").trim() as QuestionType;
    const priority = Number((cells[iPriority] || "0").trim());
    const tag = (cells[iTag] || "").trim();
    const question = (cells[iQuestion] || "").trim();

    if (!type || !question) continue;

    rows.push({
      type,
      priority: Number.isFinite(priority) ? priority : 0,
      tag,
      question,
    });
  }

  return rows;
}

export async function loadCsvFallback(): Promise<CsvFallbackRow[]> {
  // public/questions/deep_dive_fallback.csv を読む
  const res = await fetch("/questions/deep_dive_fallback.csv", { cache: "no-store" });
  if (!res.ok) return [];
  const text = await res.text();
  return parseCsv(text);
}

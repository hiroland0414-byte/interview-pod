// src/lib/questions/selector.ts
// -------------------------------------------------------------
// CSV（core_questions / additional / fallback 等）から読み込んだ行は
// ほぼ「文字列」なので、selector 側で “安全に数値化” しながら扱う。
// loader.ts の型定義（QuestionItem / AdditionalCsvRow 等）に100%整合させる。
// -------------------------------------------------------------

import type { ModeTag } from "./loader";

// ★ loader.ts に AdditionalQ が無い環境向け（あなたの loader.ts は AdditionalCsvRow）
// selector.ts では “必要な形” だけ型を定義して扱う（壊れない）
export type AdditionalCsvRow = {
  id: string;
  question: string;
  hint?: string;
  depth_followup?: string;
  A1?: string;
  A2?: string;
  B?: string;
  C?: string;
  difficulty?: string; // ← loader.ts では string
  tags?: string;
  notes?: string;
};

export type QuestionKind =
  | "core"
  | "core-depth"
  | "additional"
  | "additional-depth";

export type QuestionItem = {
  id: string;
  text: string;
  kind: QuestionKind;
  isMainCore?: boolean;
  parentId?: string;
  section?: string;
  order: number;
};

/* -----------------------------
 * utils
 * ----------------------------- */
const toNumber = (v: unknown, fallback = 0) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const truthy = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on";
};

const enabledForMode = (row: AdditionalCsvRow, mode: ModeTag) => {
  // CSV列は文字列なので truthy 判定
  const flag = (row as any)[mode] as unknown;
  return truthy(flag);
};

/* -----------------------------
 * selectors
 * ----------------------------- */

/**
 * 追加質問（additional）をモードでフィルタして返す
 * - difficulty は string なので “数値に変換して並べ替え”
 * - text は存在しないので question を使う（2339対策）
 */
export function selectAdditionalQuestions(params: {
  rows: AdditionalCsvRow[];
  mode: ModeTag;
  maxCount: number;
  preferHigherDifficulty?: boolean;
}): QuestionItem[] {
  const { rows, mode, maxCount, preferHigherDifficulty = false } = params;

  const filtered = rows.filter((r) => enabledForMode(r, mode));

  const sorted = [...filtered].sort((a, b) => {
    const da = toNumber(a.difficulty, 0);
    const db = toNumber(b.difficulty, 0);
    return preferHigherDifficulty ? db - da : da - db;
  });

  const picked = sorted.slice(0, Math.max(0, maxCount));

  return picked.map((r, idx) => ({
    id: r.id,
    text: r.question, // ✅ textではなくquestion
    kind: "additional",
    order: idx,
  }));
}

/**
 * additional に depth_followup があれば、additional-depth を1つ追加して返す
 * - order の加算は number 同士で（2362/2365対策）
 */
export function appendAdditionalFollowups(params: {
  baseItems: QuestionItem[];
  rowsById: Record<string, AdditionalCsvRow>;
}): QuestionItem[] {
  const { baseItems, rowsById } = params;

  const out: QuestionItem[] = [];

  for (const base of baseItems) {
    out.push(base);

    const row = rowsById[base.id];
    const follow = row?.depth_followup?.trim();
    if (follow) {
      out.push({
        id: `${base.id}::followup`,
        text: follow,
        kind: "additional-depth",
        parentId: base.id,
        order: base.order + 1, // ✅ number + number
      });
    }
  }

  return out;
}

/**
 * rows を id で引ける辞書にする
 */
export function indexAdditionalById(rows: AdditionalCsvRow[]): Record<string, AdditionalCsvRow> {
  const map: Record<string, AdditionalCsvRow> = {};
  for (const r of rows) map[r.id] = r;
  return map;
}

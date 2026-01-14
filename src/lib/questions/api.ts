// src/lib/questions/api.ts
import type { ModeTag } from "./loader";
import type { AdditionalCsvRow, QuestionItem } from "./selector";
import {
  selectAdditionalQuestions,
  indexAdditionalById,
  appendAdditionalFollowups,
} from "./selector";

/** core_questions.csv の最小形（列は実CSVに合わせて増やしてOK） */
export type CoreCsvRow = {
  id: string;
  question: string;
  section?: string;          // 例: motivation/selfPR/gakuchika 等
  order?: string | number;

  // モード有効フラグ（CSVは文字列で入る想定）
  A1?: string;
  A2?: string;
  B?: string;
  C?: string;

  // 既存CSVにあるなら（深掘り候補）
  depth1?: string;
  depth2?: string;
  depth3?: string;
  depth4?: string;
  depth5?: string;
};

export type DeepDiveFallbackRow = {
  id: string;
  question: string;
  tags?: string;
  notes?: string;
};

const truthy = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on";
};

const enabledForMode = (row: any, mode: ModeTag) => truthy(row?.[mode]);

const toNumber = (v: unknown, fallback = 0) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const normalize = (s: string) =>
  (s ?? "")
    .replace(/\s+/g, "")
    .replace(/[、。,.]/g, "")
    .trim()
    .toLowerCase();

/** “似た質問” を雑に弾く（完全一致＋ゆるい包含で十分実用） */
const isSimilar = (a: string, b: string) => {
  const A = normalize(a);
  const B = normalize(b);
  if (!A || !B) return false;
  if (A === B) return true;
  if (A.includes(B) || B.includes(A)) return true;
  return false;
};

/** core_questions（=三大質問など）をモード順で並べる */
export function buildCoreItems(params: {
  mode: ModeTag;
  coreRows: CoreCsvRow[];
}): QuestionItem[] {
  const { mode, coreRows } = params;

  const core = coreRows
    .filter((r) => enabledForMode(r, mode))
    .sort((a, b) => toNumber(a.order, 0) - toNumber(b.order, 0));

  return core.map((r, idx) => ({
    id: r.id,
    text: r.question,
    kind: "core",
    order: idx,
    section: r.section,
    isMainCore: true,
  }));
}

/** core CSVにある depth1..depth5 を取り出す（似たものはスキップ） */
export function getCoreDepthCandidates(coreRow: CoreCsvRow): string[] {
  const cands = [
    coreRow.depth1,
    coreRow.depth2,
    coreRow.depth3,
    coreRow.depth4,
    coreRow.depth5,
  ]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);

  // 重複/類似を間引く
  const out: string[] = [];
  for (const q of cands) {
    if (!out.some((p) => isSimilar(p, q))) out.push(q);
  }
  return out;
}

/** fallback 深掘りからも “似た質問” を避けつつ最大N個とる */
export function pickDeepDiveFallback(params: {
  fallbackRows: DeepDiveFallbackRow[];
  avoidTexts: string[]; // 既に出した/候補にある質問
  maxCount: number;     // 最大3
}): string[] {
  const { fallbackRows, avoidTexts, maxCount } = params;

  const avoid = avoidTexts.filter(Boolean);
  const out: string[] = [];

  for (const r of fallbackRows) {
    const q = (r.question ?? "").trim();
    if (!q) continue;
    if (avoid.some((a) => isSimilar(a, q))) continue;
    if (out.some((a) => isSimilar(a, q))) continue;

    out.push(q);
    if (out.length >= maxCount) break;
  }
  return out;
}

/**
 * ✅ 面接で使う質問リスト（骨格）
 * - core（順序通り）
 * - additional（selector.tsの既存ロジック）
 * ※ 深掘りは “回答後に次を決める” ので、ここでは骨格だけ返す
 */
export function getInterviewQuestionsForMode(params: {
  mode: ModeTag;
  coreRows: CoreCsvRow[];
  additionalRows: AdditionalCsvRow[];
  additionalMaxCount: number;
  preferHigherDifficulty?: boolean;
}): QuestionItem[] {
  const { mode, coreRows, additionalRows, additionalMaxCount, preferHigherDifficulty } =
    params;

  const coreItems = buildCoreItems({ mode, coreRows });

  const additionalBase = selectAdditionalQuestions({
    rows: additionalRows,
    mode,
    maxCount: additionalMaxCount,
    preferHigherDifficulty: preferHigherDifficulty ?? false,
  });

  const byId = indexAdditionalById(additionalRows);
  const additionalWithDepth = appendAdditionalFollowups({
    baseItems: additionalBase,
    rowsById: byId,
  });

  // order連番にして安定化
  return [...coreItems, ...additionalWithDepth].map((q, i) => ({
    ...q,
    order: i,
  }));
}

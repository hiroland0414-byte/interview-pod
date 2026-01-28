// src/lib/questions/index.ts
export * from "./api"; // api を使っているなら残す（不要なら消してOK）

// 共通で使うモード種別
export type ModeTag = "A1" | "A2" | "B" | "C";

export type QuestionKind =
  | "core"
  | "coreDepth"
  | "additional"
  | "additionalDepth"; // 将来用

export interface QuestionItem {
  id: string;          // core001, add001 など
  kind: QuestionKind;  // core / coreDepth / additional / additionalDepth
  section?: string;    // core_motivation など（coreのみ）
  parentId?: string;   // 深掘りの親ID
  depthLevel: number;  // 0:メイン, 1〜:深掘り
  text: string;        // 質問文
  hint: string;        // ヒント（なければ空文字）
  minChars: number;    // 必要文字数
}

// ==============================
// 簡易 CSV パーサ（カンマを含まない前提）
// ==============================
function parseCsv(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.map((line) => line.split(","));
}

// ==============================
// core_questions.csv の展開
// ==============================

interface CoreRow {
  id: string;
  section: string;
  question: string;
  hint: string;
  depth1?: string;
  depth2?: string;
  depth3?: string;
  depth4?: string;
  depth5?: string;
}

function parseCoreRows(csvText: string): CoreRow[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const [header, ...body] = rows;
  const indexOf = (name: string) => header.indexOf(name);

  const idxId = indexOf("id");
  const idxSection = indexOf("section");
  const idxQuestion = indexOf("question");
  const idxHint = indexOf("hint");
  const idxDepth1 = indexOf("depth1");
  const idxDepth2 = indexOf("depth2");
  const idxDepth3 = indexOf("depth3");
  const idxDepth4 = indexOf("depth4");
  const idxDepth5 = indexOf("depth5");

  return body.map((cols) => ({
    id: cols[idxId]?.trim() ?? "",
    section: cols[idxSection]?.trim() ?? "",
    question: cols[idxQuestion]?.trim() ?? "",
    hint: cols[idxHint]?.trim() ?? "",
    depth1: idxDepth1 >= 0 ? cols[idxDepth1]?.trim() ?? "" : "",
    depth2: idxDepth2 >= 0 ? cols[idxDepth2]?.trim() ?? "" : "",
    depth3: idxDepth3 >= 0 ? cols[idxDepth3]?.trim() ?? "" : "",
    depth4: idxDepth4 >= 0 ? cols[idxDepth4]?.trim() ?? "" : "",
    depth5: idxDepth5 >= 0 ? cols[idxDepth5]?.trim() ?? "" : "",
  }));
}

export function expandCoreQuestions(csvText: string): QuestionItem[] {
  const rows = parseCoreRows(csvText);
  const result: QuestionItem[] = [];

  const CORE_MAIN_MIN = 200;
  const CORE_DEPTH_MIN = 120;

  for (const row of rows) {
    if (!row.id || !row.question) continue;

    result.push({
      id: row.id,
      kind: "core",
      section: row.section,
      parentId: undefined,
      depthLevel: 0,
      text: row.question,
      hint: row.hint ?? "",
      minChars: CORE_MAIN_MIN,
    });

    (["depth1", "depth2", "depth3", "depth4", "depth5"] as const).forEach(
      (key, idx) => {
        const q = row[key];
        if (q && q.trim() !== "") {
          result.push({
            id: `${row.id}_d${idx + 1}`,
            kind: "coreDepth",
            section: row.section,
            parentId: row.id,
            depthLevel: idx + 1,
            text: q.trim(),
            hint: row.hint ?? "",
            minChars: CORE_DEPTH_MIN,
          });
        }
      }
    );
  }

  return result;
}

// ==============================
// additional_questions.csv の展開
// ==============================

interface AdditionalRow {
  id: string;
  question: string;
  hint: string;
  depthFollowup?: string;
  A1: string;
  A2: string;
  B: string;
  C: string;
  difficulty?: string;
  tags?: string;
  notes?: string;
}

function parseAdditionalRows(csvText: string): AdditionalRow[] {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const [header, ...body] = rows;
  const indexOf = (name: string) => header.indexOf(name);

  const idxId = indexOf("id");
  const idxQuestion = indexOf("question");
  const idxHint = indexOf("hint");
  const idxDepthFollowup = indexOf("depth_followup");
  const idxA1 = indexOf("A1");
  const idxA2 = indexOf("A2");
  const idxB = indexOf("B");
  const idxC = indexOf("C");

  const idxDifficulty = indexOf("difficulty");
  const idxTags = indexOf("tags");
  const idxNotes = indexOf("notes");

  return body.map((cols) => ({
    id: cols[idxId]?.trim() ?? "",
    question: cols[idxQuestion]?.trim() ?? "",
    hint: cols[idxHint]?.trim() ?? "",
    depthFollowup: idxDepthFollowup >= 0 ? cols[idxDepthFollowup]?.trim() ?? "" : "",
    A1: idxA1 >= 0 ? cols[idxA1]?.trim() ?? "" : "",
    A2: idxA2 >= 0 ? cols[idxA2]?.trim() ?? "" : "",
    B: idxB >= 0 ? cols[idxB]?.trim() ?? "" : "",
    C: idxC >= 0 ? cols[idxC]?.trim() ?? "" : "",
    difficulty: idxDifficulty >= 0 ? cols[idxDifficulty]?.trim() ?? "" : "",
    tags: idxTags >= 0 ? cols[idxTags]?.trim() ?? "" : "",
    notes: idxNotes >= 0 ? cols[idxNotes]?.trim() ?? "" : "",
  }));
}

function hasFlag(row: AdditionalRow, mode: ModeTag): boolean {
  if (mode === "A1") return row.A1 === "1";
  if (mode === "A2") return row.A2 === "1";
  if (mode === "B") return row.B === "1";
  return row.C === "1";
}

export function expandAdditionalQuestions(csvText: string, mode: ModeTag): QuestionItem[] {
  const rows = parseAdditionalRows(csvText);
  const result: QuestionItem[] = [];

  const ADD_MAIN_MIN = 120;

  for (const row of rows) {
    if (!row.id || !row.question) continue;
    if (!hasFlag(row, mode)) continue;

    const extraHint =
      row.depthFollowup && row.depthFollowup.trim() !== ""
        ? `【深掘りの視点】${row.depthFollowup.trim()}`
        : "";

    const mergedHint =
      (row.hint ?? "") + (row.hint && extraHint ? " " : "") + extraHint;

    result.push({
      id: row.id,
      kind: "additional",
      section: undefined,
      parentId: undefined,
      depthLevel: 0,
      text: row.question,
      hint: mergedHint,
      minChars: ADD_MAIN_MIN,
    });
  }

  return result;
}

export async function loadQuestionsForMode(mode: ModeTag): Promise<QuestionItem[]> {
  const [coreRes, addRes] = await Promise.all([
    fetch("/questions/core_questions.csv"),
    fetch("/questions/additional_questions.csv"),
  ]);

  if (!coreRes.ok) throw new Error("core_questions.csv の読み込みに失敗しました");
  if (!addRes.ok) throw new Error("additional_questions.csv の読み込みに失敗しました");

  const [coreText, addText] = await Promise.all([coreRes.text(), addRes.text()]);

  const core = expandCoreQuestions(coreText);
  const add = expandAdditionalQuestions(addText, mode);

  return [...core, ...add];
}

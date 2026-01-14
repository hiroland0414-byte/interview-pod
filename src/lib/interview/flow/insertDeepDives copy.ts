// src/lib/interview/flow/insertDeepDives.ts
// -------------------------------------------------------------
// 「3大質問の回答」直後に、深掘り質問（最大3）を差し込む。
// - ルール優先（generateDeepDiveQuestions）
// - 足りない分だけ deep_dive_fallback.csv で補完（別処理にしてもOK）
// - core_questions.csv の depth1..5（保険）と被るものはスキップ
// - kind 表記ゆれ（coreDepth / core-depth / deep-dive / deepDive）を吸収
// -------------------------------------------------------------

import type { ModeTag } from "@/lib/questions";
import type { QuestionType } from "@/lib/interview/deepDive/rules";
import {
  generateDeepDiveQuestions,
  type GenerateInput,
} from "@/lib/interview/deepDive/generateDeepDiveQuestions";

import type { InterviewQuestion } from "./buildQuestionQueue";

// もし buildQuestionQueue 側で kind を別名にしている場合でも壊れないように、ここで共通化
type InterviewQuestionKind =
  | "core"
  | "coreDepth"
  | "additional"
  | "additionalDepth"
  | "deepDive";

/** kind の表記ゆれを正規化 */
function normalizeKind(k: any): InterviewQuestionKind {
  const s = String(k ?? "").trim();
  // core depth
  if (s === "coreDepth" || s === "core-depth") return "coreDepth";
  // additional depth
  if (s === "additionalDepth" || s === "additional-depth") return "additionalDepth";
  // deep dive
  if (s === "deepDive" || s === "deep-dive") return "deepDive";
  // others
  if (s === "additional") return "additional";
  return "core";
}

function asText(v: unknown) {
  return (v == null ? "" : String(v)).trim();
}

/** テキストの「ゆるい同一判定」用に正規化（全角空白や記号をならす） */
function normalizeTextForDup(s: string) {
  return (s || "")
    .replace(/\s+/g, "")
    .replace(/[！!？?。、・「」『』（）()\[\]【】]/g, "")
    .toLowerCase();
}

/** 既存キュー内に同じ/類似の質問があるか */
function isDuplicateText(existing: InterviewQuestion[], candidateText: string) {
  const c = normalizeTextForDup(candidateText);
  if (!c) return true;
  return existing.some((q) => normalizeTextForDup(q.text) === c);
}

/** core_questions.csv 側の depth（保険）を拾う：現在の「core本体」に紐づく深掘りを候補として集める */
function collectCoreDepthInsurance(queue: InterviewQuestion[], coreMainId: string): string[] {
  const out: string[] = [];

  for (const q of queue) {
    const k = normalizeKind(q.kind);
    if (k !== "coreDepth") continue;

    // 親IDで紐づく想定（あなたの loader/index のどちらでも parentId がある可能性）
    if (q.parentId && q.parentId === coreMainId) {
      if (q.text) out.push(q.text);
    }

    // もし parentId が無い世界でも、id 命名（xxx_d1 など）で拾える場合があるので保険
    const id = asText(q.id);
    if (!q.parentId && id && id.startsWith(`${coreMainId}_d`)) {
      if (q.text) out.push(q.text);
    }
  }

  return out;
}

/** missingSignals を “壊れない軽量推定” で生成（GenerateInput の必須を満たす） */
function inferMissingSignals(type: QuestionType, answer: string): GenerateInput["missingSignals"] {
  const t = answer || "";
  const miss: string[] = [];

  // 結論っぽい立ち上がり
  const hasConclusion =
    /結論|志望(理由|動機)は|私の強みは|学生時代(に)?力を入れた(こと)?は|取り組んだ(こと)?は|私が大切にしているのは/.test(t);
  if (!hasConclusion) miss.push("missing_conclusion");

  // 具体性（数字/期間/場面）
  const hasNumbers = /[0-9０-９]+/.test(t);
  const hasTime = /(年|ヶ月|か月|週|日|回|人|名|件|％|パーセント)/.test(t);
  const hasScene = /(例えば|具体的に|その時|場面|際に)/.test(t);
  if (!(hasNumbers || hasTime || hasScene)) miss.push("missing_specificity");

  // 気持ち/価値観（なぜ）
  const hasWhy = /(なぜなら|理由は|背景は|きっかけ|大切にしている|価値観)/.test(t);
  const hasEmotion = /(悔し|嬉し|不安|緊張|達成|やりがい|悩|葛藤|大変|苦労)/.test(t);
  if (!(hasWhy || hasEmotion)) miss.push("missing_feelings");

  // 志望動機：施設×職種の接続
  if (type === "motivation") {
    const hasPlace = /(貴院|御院|貴施設|御施設|理念|方針|地域|救急|がん|健診|教育)/.test(t);
    const hasJob = /(診療放射線技師|放射線|画像|CT|MRI|検査|患者|チーム医療)/.test(t);
    if (!(hasPlace && hasJob)) miss.push("missing_fit");
  }

  // ガクチカ：結果/成果
  if (type === "gakuchika") {
    const hasResult = /(結果|成果|改善|達成|増え|減り|上がり|下がり|評価)/.test(t);
    if (!hasResult) miss.push("missing_result");
  }

  // 自己PR：強みの言い切り
  if (type === "self_pr") {
    const hasStrength = /(私の強みは|強み|得意|長所)/.test(t);
    if (!hasStrength) miss.push("missing_strength");
  }

  // 何も欠けてない場合でも空配列にせず保険
  if (miss.length === 0) miss.push("ok");

  return miss as GenerateInput["missingSignals"];
}

/** deepDive を InterviewQuestion に変換（hint は必ず string にする） */
function toDeepDiveQuestion(params: {
  parent: InterviewQuestion;
  text: string;
  idx: number;
  mode: ModeTag;
}): InterviewQuestion {
  const { parent, text, idx, mode } = params;

  return {
    id: `${parent.id}__deep_${idx + 1}`,
    text,
    hint: "", // ← undefined 禁止の環境でも安全
    kind: "deepDive" as any, // buildQuestionQueue の kind が union の場合でも通す
    parentId: parent.id,
    section: parent.section,
    depthLevel: (parent.depthLevel ?? 0) + 1,
    minChars: parent.minChars ?? 120, // 深掘りも同じ文字数基準でOK（必要なら120固定にしてもいい）
    mode,
  };
}

/**
 * 3大質問の「本体(core)」の回答後に、深掘り最大3を差し込む
 *
 * - queue: 現在の質問キュー
 * - atIndex: “回答した質問” の index（この直後に差し込む）
 * - answer: 回答テキスト
 * - type: "motivation" | "self_pr" | "gakuchika"
 * - tone: "strict" | "gentle"
 * - mode: A1/A2/B/C
 */
export async function insertDeepDives(params: {
  queue: InterviewQuestion[];
  atIndex: number;
  answer: string;
  type: QuestionType;
  tone: "strict" | "gentle";
  mode: ModeTag;
  maxDeepDives?: number; // default 3
}): Promise<InterviewQuestion[]> {
  const {
    queue,
    atIndex,
    answer,
    type,
    tone,
    mode,
    maxDeepDives = 3,
  } = params;

  const baseQueue = Array.isArray(queue) ? queue : [];
  const parent = baseQueue[atIndex];

  // index が壊れていたら何もしない
  if (!parent) return baseQueue;

  // “core 本体”以外では深掘りを入れない（安全運用）
  // ※ kind 表記ゆれに対応
  const parentKind = normalizeKind(parent.kind);
  if (parentKind !== "core") return baseQueue;

  // すでに deepDive が直後に入っているなら二重挿入しない
  const next1 = baseQueue[atIndex + 1];
  if (next1 && normalizeKind(next1.kind) === "deepDive" && next1.parentId === parent.id) {
    return baseQueue;
  }

  // core_questions.csv の depth1..5（保険）を取得
  const insuranceDepths = collectCoreDepthInsurance(baseQueue, parent.id);

  // generateDeepDiveQuestions に渡す missingSignals を作る
  const missingSignals = inferMissingSignals(type, answer);

  // ルール深掘り（最大3）を生成
  const candsAll = await generateDeepDiveQuestions({
    type,
    answer,
    tone,
    missingSignals,
  } as GenerateInput);

  // ここで「重複除去」と「保険depthと被るもの除去」
  const existingAround = [...baseQueue]; // 既存全体で重複チェック（安全）
  const insuranceNorm = new Set(insuranceDepths.map(normalizeTextForDup));

  const picked: string[] = [];
  for (const c of candsAll || []) {
    const text = asText(c);
    if (!text) continue;

    // 保険 depth と同じ/類似ならスキップ（同じことを聞かない）
    if (insuranceNorm.has(normalizeTextForDup(text))) continue;

    // 既存キューに同一があればスキップ
    if (isDuplicateText(existingAround, text)) continue;

    picked.push(text);
    if (picked.length >= maxDeepDives) break;
  }

  // もし 0 件なら、ここでは「何も入れない」でOK
  // （fallback を別の insert で補完する設計でも良い）
  if (picked.length === 0) return baseQueue;

  // deepDive 質問に変換して、atIndex の直後へ差し込む
  const deepQs = picked.map((text, idx) =>
    toDeepDiveQuestion({ parent, text, idx, mode })
  );

  const head = baseQueue.slice(0, atIndex + 1);
  const tail = baseQueue.slice(atIndex + 1);

  return [...head, ...deepQs, ...tail];
}

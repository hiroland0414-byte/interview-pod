// src/lib/interview/flow/insertDeepDives.ts
// -------------------------------------------------------------
// 「3大質問の回答」直後に、深掘り質問（最大3）を差し込む。
// - ルール優先（generateDeepDiveQuestions）
// - core_questions.csv の depth1..5（保険）と被るものはスキップ
// - kind 表記ゆれ（coreDepth / core-depth / deep-dive / deepDive）を吸収
// -------------------------------------------------------------

import type { ModeTag } from "@/lib/questions";
import type { QuestionType } from "@/lib/interview/deepDive/rules";
import {
  generateDeepDiveQuestions,
  type MissingSignal,
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
  if (s === "coreDepth" || s === "core-depth") return "coreDepth";
  if (s === "additionalDepth" || s === "additional-depth") return "additionalDepth";
  if (s === "deepDive" || s === "deep-dive") return "deepDive";
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

/** core_questions.csv 側の depth（保険）を拾う */
function collectCoreDepthInsurance(queue: InterviewQuestion[], coreMainId: string): string[] {
  const out: string[] = [];

  for (const q of queue) {
    const k = normalizeKind(q.kind);
    if (k !== "coreDepth") continue;

    if (q.parentId && q.parentId === coreMainId) {
      if (q.text) out.push(q.text);
    }

    const id = asText(q.id);
    if (!q.parentId && id && id.startsWith(`${coreMainId}_d`)) {
      if (q.text) out.push(q.text);
    }
  }

  return out;
}

/**
 * missingSignals を “壊れない軽量推定” で生成（MissingSignal 準拠）
 * - 厳密な評価は evaluateThreeMajor でやる
 * - ここは「深掘り質問の方向性」を決めるだけ
 */
function inferMissingSignals(type: QuestionType, answer: string): MissingSignal[] {
  const t = answer || "";
  const miss: MissingSignal[] = [];

  // 結論っぽい立ち上がり（自己PRは特に重要）
  const hasConclusion =
    /結論|志望(理由|動機)は|私の強みは|学生時代(に)?力を入れた(こと)?は|取り組んだ(こと)?は|私が大切にしているのは/.test(t);

  if (!hasConclusion) {
    // 自己PRなら headline_missing が刺さる
    if (type === "self_pr") miss.push("headline_missing");
    // 他は「行動/挑戦の明示」不足として扱う
    else miss.push("action_weak");
  }

  // 具体性（数字/期間/場面）
  const hasNumbers = /[0-9０-９]+/.test(t);
  const hasTime = /(年|ヶ月|か月|週|日|回|人|名|件|％|パーセント)/.test(t);
  const hasScene = /(例えば|具体的に|その時|場面|際に)/.test(t);

  if (!hasScene) miss.push("no_specific_episode");
  if (!(hasNumbers || hasTime)) miss.push("no_numbers");

  // 結果/成果
  const hasResult = /(結果|成果|改善|達成|増え|減り|上がり|下がり|評価|反応)/.test(t);
  if (!hasResult) miss.push("no_result");

  // 学び/振り返り
  const hasReflection = /(学(ん|び)|気づ(い|き)|反省|改善|工夫|次は)/.test(t);
  if (!hasReflection) miss.push("no_reflection");

  // 仕事への接続（活かす/貢献）
  const hasTransfer = /(活か|貢献|入職後|現場|仕事|御院|貴院|御施設|貴施設)/.test(t);
  if (!hasTransfer) miss.push("no_transfer");

  // 抽象語が多い
  const abstractHits =
    (t.match(/コミュニケーション(力)?|協調性|主体性|努力|頑張|成長|貢献|責任感|真面目/g) || []).length;
  if (abstractHits >= 2 && !(hasNumbers || hasTime || hasScene)) miss.push("too_vague");

  // 志望動機： “ここ” が弱い
  if (type === "motivation") {
    const hasPlace =
      /(貴院|御院|貴施設|御施設|理念|方針|地域|救急|がん|健診|教育|研修)/.test(t);
    const hasJob =
      /(診療放射線技師|放射線|画像|CT|MRI|検査|患者|チーム医療|安全管理)/.test(t);

    if (!(hasPlace && hasJob)) miss.push("why_here_weak");

    const hasFuture = /(将来|今後|目指|取り組みたい|実現したい|貢献したい)/.test(t);
    if (!hasFuture) miss.push("future_weak");
  }

  // 最大3に寄せたいので、優先度順に圧縮（※ generate側も最大3にするが、ここで整えると安定）
  const priority: MissingSignal[] = [
    "headline_missing",
    "why_here_weak",
    "no_specific_episode",
    "no_numbers",
    "no_result",
    "no_reflection",
    "no_transfer",
    "future_weak",
    "too_vague",
    "action_weak",
  ];

  const uniqMiss = Array.from(new Set(miss));
  const sorted = priority.filter((p) => uniqMiss.includes(p));

  // 何も無い時は、質問タイプ別の既定に任せる（空配列でOK）
  return sorted;
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
    hint: "", // undefined 禁止でも安全
    kind: "deepDive" as any,
    parentId: parent.id,
    section: parent.section,
    depthLevel: (parent.depthLevel ?? 0) + 1,
    minChars: parent.minChars ?? 120,
    mode,
  };
}

export async function insertDeepDives(params: {
  queue: InterviewQuestion[];
  atIndex: number;
  answer: string;
  type: QuestionType;
  tone: "strict" | "gentle";
  mode: ModeTag;
  maxDeepDives?: number; // default 3
}): Promise<InterviewQuestion[]> {
  const { queue, atIndex, answer, type, tone, mode, maxDeepDives = 3 } = params;

  const baseQueue = Array.isArray(queue) ? queue : [];
  const parent = baseQueue[atIndex];
  if (!parent) return baseQueue;

  const parentKind = normalizeKind(parent.kind);
  if (parentKind !== "core") return baseQueue;

  // 二重挿入防止
  const next1 = baseQueue[atIndex + 1];
  if (next1 && normalizeKind(next1.kind) === "deepDive" && next1.parentId === parent.id) {
    return baseQueue;
  }

  // 保険depth（core_questions.csv 側）
  const insuranceDepths = collectCoreDepthInsurance(baseQueue, parent.id);
  const insuranceNorm = new Set(insuranceDepths.map(normalizeTextForDup));

  // missingSignals（軽量推定）
  const missingSignals = inferMissingSignals(type, answer);

  // ルール深掘り生成（最大3）
  const candsAll = await generateDeepDiveQuestions({
    type,
    answer,
    tone,
    missingSignals, // ← GenerateInput 側は optional にしたので、無しでも動くが、ここは渡す
    maxQuestions: maxDeepDives,
  });

  // 重複除去 ＋ 保険depthと被るもの除去
  const existingAround = [...baseQueue];
  const picked: string[] = [];

  for (const c of candsAll || []) {
    const text = asText(c);
    if (!text) continue;

    if (insuranceNorm.has(normalizeTextForDup(text))) continue;
    if (isDuplicateText(existingAround, text)) continue;

    picked.push(text);
    if (picked.length >= maxDeepDives) break;
  }

  if (picked.length === 0) return baseQueue;

  const deepQs = picked.map((text, idx) => toDeepDiveQuestion({ parent, text, idx, mode }));

  const head = baseQueue.slice(0, atIndex + 1);
  const tail = baseQueue.slice(atIndex + 1);

  return [...head, ...deepQs, ...tail];
}

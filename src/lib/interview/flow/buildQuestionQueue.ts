// src/lib/interview/flow/buildQuestionQueue.ts
// -------------------------------------------------------------
// 面接ページが扱いやすい「進行キュー」を作る（型を統一して順序も固定）
// Source of truth: src/lib/questions/index.ts の QuestionItem
// -------------------------------------------------------------

import type { ModeTag, QuestionItem } from "@/lib/questions";
import { loadQuestionsForMode } from "@/lib/questions";

export type InterviewQuestionKind =
  | "core"
  | "coreDepth"
  | "additional"
  | "additionalDepth"
  | "deepDive"; // 回答起点の深掘り（最大3）で後から差し込む用

export type InterviewQuestion = {
  id: string;
  text: string;
  hint: string;
  kind: InterviewQuestionKind;
  parentId?: string;
  section?: string;
  depthLevel: number;
  minChars: number;
  mode: ModeTag;
};

function mapKind(k: QuestionItem["kind"]): InterviewQuestionKind {
  // index.ts の kind と完全一致させる
  if (k === "core") return "core";
  if (k === "coreDepth") return "coreDepth";
  if (k === "additional") return "additional";
  return "additionalDepth";
}

function normalizeFromQuestionItem(x: QuestionItem, mode: ModeTag): InterviewQuestion {
  return {
    id: x.id,
    text: x.text,
    hint: x.hint ?? "",
    kind: mapKind(x.kind),
    parentId: x.parentId,
    section: x.section,
    depthLevel: typeof x.depthLevel === "number" ? x.depthLevel : 0,
    minChars: typeof x.minChars === "number" ? x.minChars : 120,
    mode,
  };
}

/**
 * 面接用の質問キューを作る（推奨：これを interview/page.tsx から呼ぶ）
 * - core（3大質問＋CSV深掘り）→ additional（モード別）
 * - 順序は CSV 展開の順を尊重（= 仕様通り固定）
 */
export async function buildQuestionQueue(mode: ModeTag): Promise<InterviewQuestion[]> {
  const items = await loadQuestionsForMode(mode);

  // 念のため空行除外（CSVが荒れても落ちない）
  const cleaned = items.filter((q) => (q.text ?? "").trim().length > 0);

  return cleaned.map((q) => normalizeFromQuestionItem(q, mode));
}

/**
 * deep-dive（回答起点の最大3）を「直後」に差し込むユーティリティ
 * - 同じ/類似質問を入れたくない時は呼び出し側で弾く（後で実装）
 */
export function insertDeepDiveAfter(params: {
  queue: InterviewQuestion[];
  afterId: string;      // どの質問の後に入れるか
  deepDiveTexts: string[]; // 最大3想定
  minChars?: number;
}): InterviewQuestion[] {
  const { queue, afterId, deepDiveTexts, minChars = 120 } = params;
  if (!deepDiveTexts?.length) return queue;

  const out: InterviewQuestion[] = [];
  for (const q of queue) {
    out.push(q);
    if (q.id === afterId) {
      deepDiveTexts.slice(0, 3).forEach((t, idx) => {
        out.push({
          id: `${afterId}__deepDive${idx + 1}`,
          text: t,
          hint: "",
          kind: "deepDive",
          parentId: afterId,
          section: q.section,
          depthLevel: q.depthLevel + 1,
          minChars,
          mode: q.mode,
        });
      });
    }
  }
  return out;
}

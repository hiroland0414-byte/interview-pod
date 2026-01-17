// src/lib/history/interviewDraft.ts
"use client";

import type { ModeTag } from "@/lib/questions";

export type InterviewDraftV1 = {
  version: 1;
  mode: ModeTag;
  updatedAt: string;

  // 質問ID -> 入力内容（途中の下書きも含む）
  answersById: Record<string, string>;

  // どこまで進んだか（UI表示の補助。再開はIDベースで計算する）
  lastIndex?: number;
  lastQuestionId?: string;
};

const KEY_PREFIX = "kcareer.interviewDraft.v1.";

function key(mode: ModeTag) {
  return `${KEY_PREFIX}${mode}`;
}

export function loadInterviewDraft(mode: ModeTag): InterviewDraftV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InterviewDraftV1;
    if (!parsed || parsed.version !== 1) return null;
    if (parsed.mode !== mode) return null;
    if (!parsed.answersById || typeof parsed.answersById !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveInterviewDraft(mode: ModeTag, next: InterviewDraftV1) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(mode), JSON.stringify(next));
  } catch {
    // localStorageが使えない環境でもアプリは動かす
  }
}

export function upsertInterviewDraft(
  mode: ModeTag,
  patch: Partial<InterviewDraftV1> & { answersPatch?: Record<string, string> }
) {
  if (typeof window === "undefined") return;

  const cur =
    loadInterviewDraft(mode) ??
    ({
      version: 1,
      mode,
      updatedAt: new Date().toISOString(),
      answersById: {},
    } as InterviewDraftV1);

  const merged: InterviewDraftV1 = {
    ...cur,
    ...patch,
    version: 1,
    mode,
    updatedAt: new Date().toISOString(),
    answersById: {
      ...cur.answersById,
      ...(patch.answersPatch ?? {}),
    },
  };

  saveInterviewDraft(mode, merged);
}

export function clearInterviewDraft(mode: ModeTag) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key(mode));
  } catch {}
}

export function hasProgress(draft: InterviewDraftV1 | null) {
  if (!draft) return false;
  const keys = Object.keys(draft.answersById || {});
  if (keys.length === 0) return false;
  // 空文字だけの保存は“進捗なし”扱い
  return keys.some((k) => (draft.answersById[k] || "").trim().length > 0);
}

/**
 * 「次に再開すべき質問」をIDベースで決める：
 * - queueの順に見て、answersById に“有効な回答（trim>0）”が無い最初の質問へ
 * - 全部埋まってたら最後（queue.length-1）へ
 */
export function findResumeIndex(
  queue: { id: string }[],
  draft: InterviewDraftV1 | null
): number {
  if (!draft) return 0;
  const map = draft.answersById || {};
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]?.id;
    if (!id) continue;
    const v = (map[id] ?? "").trim();
    if (!v) return i;
  }
  return Math.max(0, queue.length - 1);
}

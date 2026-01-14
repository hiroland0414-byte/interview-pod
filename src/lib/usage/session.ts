// src/lib/usage/session.ts
// UIは触らず、セッション（sessionStorage）操作をここに集約する

export type ModeTag = "A1" | "A2" | "B" | "C";

export type AnswerItem = {
  questionText: string;
  answerText: string;
};

const KEYS = {
  mode: "kcareer.session.mode",
  trainedAt: "kcareer.session.trainedAt",
  answers: "kcareer.session.answers",
  feedback: "kcareer.session.feedback",
  radarScores: "kcareer.session.radarScores",
} as const;

function ss(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function initSession(mode: ModeTag) {
  const store = ss();
  if (!store) return;

  // 重要：前回の残骸を消す（幽霊バグ対策）
  store.setItem(KEYS.mode, mode);
  store.setItem(KEYS.trainedAt, new Date().toISOString());
  store.setItem(KEYS.answers, JSON.stringify([] as AnswerItem[]));

  // 結果系は必ずクリア（finish表示混線防止）
  store.removeItem(KEYS.feedback);
  store.removeItem(KEYS.radarScores);
}

export function getMode(): ModeTag | null {
  const store = ss();
  if (!store) return null;
  const v = store.getItem(KEYS.mode);
  if (v === "A1" || v === "A2" || v === "B" || v === "C") return v;
  return null;
}

export function getTrainedAt(): string | null {
  const store = ss();
  if (!store) return null;
  return store.getItem(KEYS.trainedAt);
}

export function getAnswers(): AnswerItem[] {
  const store = ss();
  if (!store) return [];
  return safeJsonParse<AnswerItem[]>(store.getItem(KEYS.answers), []);
}

export function setAnswers(items: AnswerItem[]) {
  const store = ss();
  if (!store) return;
  store.setItem(KEYS.answers, JSON.stringify(items));
}

export function pushAnswer(item: AnswerItem) {
  const items = getAnswers();
  items.push(item);
  setAnswers(items);
}

export function clearResultsOnly() {
  const store = ss();
  if (!store) return;
  store.removeItem(KEYS.feedback);
  store.removeItem(KEYS.radarScores);
}

export function setFeedback(feedback: unknown) {
  const store = ss();
  if (!store) return;
  store.setItem(KEYS.feedback, JSON.stringify(feedback));
}

export function getFeedback<T = unknown>(): T | null {
  const store = ss();
  if (!store) return null;
  return safeJsonParse<T | null>(store.getItem(KEYS.feedback), null);
}

export function setRadarScores(scores: unknown) {
  const store = ss();
  if (!store) return;
  store.setItem(KEYS.radarScores, JSON.stringify(scores));
}

export function getRadarScores<T = unknown>(): T | null {
  const store = ss();
  if (!store) return null;
  return safeJsonParse<T | null>(store.getItem(KEYS.radarScores), null);
}

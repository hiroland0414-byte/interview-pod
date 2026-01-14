// src/lib/impression/session.ts
"use client";

export type ImpressionSelfCheck = {
  eyeContact: number;   // 1-5
  smile: number;        // 1-5
  nodding: number;      // 1-5
  voiceVolume: number;  // 1-5
  voiceSpeed: number;   // 1-5 (3が適正)
  conclusionFirst: number; // 1-5
};

export type ImpressionSnapshot = {
  savedAt: string;
  durationSec: number;
  topic: string;
  answerText: string;
  charCount: number;
  charsPerMin: number;
  selfCheck: ImpressionSelfCheck;
  feedback: string;
};

const KEY = {
  topic: "kcareer.impression.topic",
  duration: "kcareer.impression.durationSec",
  trainedAt: "kcareer.impression.trainedAt",
  answer: "kcareer.impression.answerText",
  self: "kcareer.impression.selfCheck",
  feedback: "kcareer.impression.feedback",
  history: "kcareer.impression.history",
} as const;

export function clearImpressionSession() {
  if (typeof window === "undefined") return;
  Object.values(KEY).forEach((k) => {
    try {
      sessionStorage.removeItem(k);
    } catch {
      // noop
    }
  });
}

export function saveImpressionSession(data: Partial<ImpressionSnapshot>) {
  if (typeof window === "undefined") return;

  if (data.topic != null) sessionStorage.setItem(KEY.topic, data.topic);
  if (data.durationSec != null) sessionStorage.setItem(KEY.duration, String(data.durationSec));
  if (data.answerText != null) sessionStorage.setItem(KEY.answer, data.answerText);
  if (data.feedback != null) sessionStorage.setItem(KEY.feedback, data.feedback);

  if (data.selfCheck != null) {
    sessionStorage.setItem(KEY.self, JSON.stringify(data.selfCheck));
  }

  if (data.savedAt != null) sessionStorage.setItem(KEY.trainedAt, data.savedAt);
}

export function loadImpressionSession(): Partial<ImpressionSnapshot> {
  if (typeof window === "undefined") return {};
  const topic = sessionStorage.getItem(KEY.topic) || "自己紹介（30〜60秒）";
  const durationSec = Number(sessionStorage.getItem(KEY.duration) || "60") || 60;
  const trainedAt = sessionStorage.getItem(KEY.trainedAt) || "";
  const answerText = sessionStorage.getItem(KEY.answer) || "";
  const feedback = sessionStorage.getItem(KEY.feedback) || "";

  const selfRaw = sessionStorage.getItem(KEY.self);
  const selfCheck: ImpressionSelfCheck =
    (selfRaw ? safeJson(selfRaw, null) : null) ||
    defaultSelfCheck();

  const charCount = (answerText || "").replace(/\s/g, "").length;
  const charsPerMin = durationSec > 0 ? Math.round((charCount / durationSec) * 60) : 0;

  return {
    topic,
    durationSec,
    savedAt: trainedAt,
    answerText,
    feedback,
    selfCheck,
    charCount,
    charsPerMin,
  };
}

export function loadLastSnapshot(): ImpressionSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY.history);
  const arr = raw ? safeJson(raw, []) as ImpressionSnapshot[] : [];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[arr.length - 1] || null;
}

export function pushSnapshot(s: ImpressionSnapshot) {
  if (typeof window === "undefined") return;
  const raw = sessionStorage.getItem(KEY.history);
  const arr = raw ? safeJson(raw, []) as ImpressionSnapshot[] : [];
  const next = Array.isArray(arr) ? arr : [];
  next.push(s);
  // 直近10件だけ残す
  const trimmed = next.slice(-10);
  sessionStorage.setItem(KEY.history, JSON.stringify(trimmed));
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function defaultSelfCheck(): ImpressionSelfCheck {
  return {
    eyeContact: 3,
    smile: 3,
    nodding: 3,
    voiceVolume: 3,
    voiceSpeed: 3,
    conclusionFirst: 3,
  };
}

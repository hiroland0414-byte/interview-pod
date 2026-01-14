// src/lib/history/interviewHistory.ts
import type { ModeTag } from "@/lib/questions";

export type RadarScores = Record<string, number>;

export type InterviewResultSnapshot = {
  savedAt: string; // ISO
  mode: ModeTag;
  scores: RadarScores;
  feedback: string;
  answers: { questionText: string; answerText: string }[];
};

const keyForMode = (mode: ModeTag) => `kcareer.history.interview.${mode}`;

export function loadPreviousResult(mode: ModeTag): InterviewResultSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(keyForMode(mode));
    return raw ? (JSON.parse(raw) as InterviewResultSnapshot) : null;
  } catch {
    return null;
  }
}

export function saveCurrentResult(snapshot: InterviewResultSnapshot) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(keyForMode(snapshot.mode), JSON.stringify(snapshot));
  } catch {}
}

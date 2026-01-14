// src/lib/feedback/feedbackSession.ts

export type FeedbackType = "motivation" | "self_pr" | "gakuchika";

export type FeedbackItem = {
  type: FeedbackType;
  text: string;
};

export const TYPE_ORDER: FeedbackType[] = ["motivation", "self_pr", "gakuchika"];

export const TITLE_MAP: Record<FeedbackType, string> = {
  motivation: "志望動機に関するフィードバック",
  self_pr: "自己PRに関するフィードバック",
  gakuchika: "学生時代に力を入れたことに関するフィードバック",
};

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * sessionStorage の feedback は 2 形態を吸収:
 * 1) 旧：string（1本の文章）
 * 2) 新：FeedbackItem[] を JSON.stringify した文字列
 */
export function parseFeedbackFromSession(raw: string | null | undefined): FeedbackItem[] {
  const s = (raw ?? "").trim();
  if (!s) return [];

  // JSON配列の可能性
  if (s.startsWith("[") || s.startsWith("{")) {
    const parsed = safeJson<unknown>(s, null);

    if (Array.isArray(parsed)) {
      const out: FeedbackItem[] = (parsed as any[])
        .map((x: any) => ({
          type: x?.type as FeedbackType,
          text: String(x?.text ?? "").trim(),
        }))
        .filter(
          (x: FeedbackItem) =>
            (x.type === "motivation" || x.type === "self_pr" || x.type === "gakuchika") &&
            x.text.length > 0
        );

      if (out.length) return out;
    }
  }

  // 旧形式：文字列1本 → 志望動機として暫定表示
  return [{ type: "motivation", text: s }];
}

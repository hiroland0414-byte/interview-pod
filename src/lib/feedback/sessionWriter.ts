// src/lib/feedback/sessionWriter.ts
import type { FeedbackItem } from "./generateLocal";

const KEY = "kcareer.session.feedback";

/**
 * finish/page.tsx は sessionStorage の "kcareer.session.feedback" を
 * そのまま表示する前提なので、ここで見出し付きの1テキストに整形して保存する。
 */
export function saveFeedbackToSession(items: FeedbackItem[]) {
  if (typeof window === "undefined") return;

  const text = (items || [])
    .map((it) => {
      const title = (it.title || "").trim();
      const body = (it.body || "").trim();
      return [title, body].filter(Boolean).join("\n");
    })
    .join("\n\n――――――――――――――――――――\n\n");

  sessionStorage.setItem(KEY, text);
}

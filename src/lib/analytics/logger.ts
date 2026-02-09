// src/lib/analytics/logger.ts
"use client";

type EventName =
  | "open_start"
  | "open_interview"
  | "open_impression_guide"
  | "open_impression_record"
  | "open_impression_result"
  | "click_mode_select"
  | "click_next"
  | "click_retry"
  | "finish_interview"
  | "finish_impression";

type LogPayload = {
  v: 1;
  event: EventName;
  ts: string;
  mode?: string;
  qid?: string;
  extra?: Record<string, string | number | boolean | null>;
};

const ENDPOINT = "/api/log";

// ✅ 送信失敗しても落とさない（β運用の安定性優先）
export function logEvent(
  event: EventName,
  opts?: { mode?: string; qid?: string; extra?: LogPayload["extra"] }
) {
  if (typeof window === "undefined") return;

  const payload: LogPayload = {
    v: 1,
    event,
    ts: new Date().toISOString(),
    mode: opts?.mode,
    qid: opts?.qid,
    extra: opts?.extra,
  };

  // sendBeacon が使えれば最優先（画面遷移直前でも落ちにくい）
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }
  } catch {}

  // fallback: fetch
  try {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

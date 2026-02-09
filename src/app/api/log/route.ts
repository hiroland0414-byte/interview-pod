// src/app/api/log/route.ts
import { NextResponse } from "next/server";

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

type Payload = {
  v: 1;
  event: EventName;
  ts: string; // ISO
  mode?: string; // A1/A2/B/C 等（任意）
  qid?: string; // 質問ID（任意）
  extra?: Record<string, string | number | boolean | null>;
};

// ✅ 許可するイベントだけ受け付ける（勝手な文字列を保存しない）
const ALLOW: Record<string, true> = {
  open_start: true,
  open_interview: true,
  open_impression_guide: true,
  open_impression_record: true,
  open_impression_result: true,
  click_mode_select: true,
  click_next: true,
  click_retry: true,
  finish_interview: true,
  finish_impression: true,
};

function isObject(x: unknown): x is Record<string, any> {
  return typeof x === "object" && x !== null;
}

function sanitize(raw: any): Payload | null {
  if (!isObject(raw)) return null;

  const v = raw.v;
  const event = String(raw.event ?? "");
  const ts = String(raw.ts ?? "");

  if (v !== 1) return null;
  if (!ALLOW[event]) return null;
  if (!ts || Number.isNaN(Date.parse(ts))) return null;

  const out: Payload = { v: 1, event: event as EventName, ts };

  if (raw.mode != null) out.mode = String(raw.mode).slice(0, 20);
  if (raw.qid != null) out.qid = String(raw.qid).slice(0, 80);

  // extra はキー数/サイズを制限（巨大データや個人情報混入を防ぐ）
  if (raw.extra && isObject(raw.extra)) {
    const extra: Record<string, any> = {};
    const keys = Object.keys(raw.extra).slice(0, 10);
    for (const k of keys) {
      const val = raw.extra[k];
      if (typeof val === "string") extra[k] = val.slice(0, 120);
      else if (typeof val === "number" || typeof val === "boolean" || val === null) extra[k] = val;
    }
    out.extra = extra;
  }

  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = sanitize(body);
    if (!payload) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // ✅ 最小構成：サーバログへ JSON を出す
    // Vercel運用なら Logs で [KC_LOG] を検索して集計できる
    console.log("[KC_LOG]", JSON.stringify(payload));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET() {
  // 疎通確認用（そのまま残す）
  return NextResponse.json({ ok: true, message: "log endpoint is alive" });
}

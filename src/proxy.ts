// interview-pod/src/proxy.ts
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyHubToken } from "@/lib/hubLink";

const APP_COOKIE = "kc_app_auth";
const MAX_AGE_DAYS = 30; // Cookie最大30日（運用に合わせて変更OK）
const MAX_AGE = 60 * 60 * 24 * MAX_AGE_DAYS;

function isPublicAssetPath(pathname: string) {
  // Nextの内部・アイコン・静的ファイル（拡張子あり）を除外
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ 画像やcss/jsまでゲートすると「全部LPへ」問題が再発するので除外
  if (isPublicAssetPath(pathname)) return NextResponse.next();

  const lpUrl = process.env.LP_URL ?? "";
  const secret = process.env.HUB_LINK_SECRET ?? "";
  const appId = process.env.APP_ID ?? "";

  if (!lpUrl || !secret || !appId) {
    return new NextResponse("Missing env (LP_URL / HUB_LINK_SECRET / APP_ID).", {
      status: 500,
    });
  }

  // ✅ すでに入場済みなら通す（強制ログアウトなし）
  if (req.cookies.get(APP_COOKIE)?.value === "1") return NextResponse.next();

  // ✅ LPから来た “通行証(kch)” を検証（ログ付き）
  const token = req.nextUrl.searchParams.get("kch") ?? "";

  const verifyResult = token
    ? verifyHubToken(token, secret, appId)
    : ({ ok: false, reason: "no-token" } as const);

  console.log("[kch-debug]", {
    pathname,
    hasToken: !!token,
    ok: verifyResult.ok,
    reason: verifyResult.reason ?? "(none)",
    appId,
    secretLength: secret.length,
  });

  if (!verifyResult.ok) {
    const to = new URL(lpUrl);
    to.searchParams.set("from", appId);
    return NextResponse.redirect(to, 307);
  }

  // ✅ OK → Cookie発行して通す
  const res = NextResponse.next();
  res.cookies.set(APP_COOKIE, "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });

  return res;
}

export const config = { matcher: ["/:path*"] };
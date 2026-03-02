// interview-pod/src/proxy.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyHubToken } from "@/lib/hubLink";

const APP_COOKIE = "kc_app_auth";
const MAX_AGE_DAYS = 30;
const MAX_AGE = 60 * 60 * 24 * MAX_AGE_DAYS;

function isPublicAssetPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicAssetPath(pathname)) return NextResponse.next();

  const lpUrl = process.env.LP_URL ?? "";
  const secret = process.env.HUB_LINK_SECRET ?? "";
  const appId = process.env.APP_ID ?? "";

  if (!lpUrl || !secret || !appId) {
    return new NextResponse("Missing env (LP_URL / HUB_LINK_SECRET / APP_ID).", { status: 500 });
  }

  // すでに入場済みなら通す
  if (req.cookies.get(APP_COOKIE)?.value === "1") return NextResponse.next();

  // LPから来た通行証(kch)を検証
  const token = req.nextUrl.searchParams.get("kch") ?? "";

  const verifyResult = token
    ? verifyHubToken(token, secret, appId)
    : ({ ok: false, reason: "no-token" } as const);

  // デバッグ（Vercel Logsで見える）
  console.log("[kch-debug]", {
    ok: verifyResult.ok,
    reason: verifyResult.reason ?? "(none)",
    appId,
    secretLength: secret.length,
    path: pathname,
  });

  if (!verifyResult.ok) {
    const to = new URL(lpUrl);
    to.searchParams.set("from", appId);
    return NextResponse.redirect(to, 307);
  }

  // OK → Cookie発行して通す
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

// ✅ 超重要：Edgeじゃなく Node で動かす（crypto を安全に使うため）
export const runtime = "nodejs";

// matcher は middleware.ts 側で使うのが基本だけど、残してもOK
export const config = { matcher: ["/:path*"] };
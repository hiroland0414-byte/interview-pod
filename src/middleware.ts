// interview-pod/src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyHubToken } from "./lib/hubLink"; // ← 相対でOK（あなたはこれで確実に動く状態）

function isPublicAssetPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  // 拡張子のある静的ファイル（png/jpg/css/js等）は除外
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 静的アセットは通す（これを忘れると画像等が全部リダイレクト地獄になります）
  if (isPublicAssetPath(pathname)) return NextResponse.next();

  const lpUrl = process.env.LP_URL ?? "https://kc-lp.vercel.app";
  const secret = process.env.HUB_LINK_SECRET ?? "";
  const appId = process.env.APP_ID ?? "";

  if (!secret || !appId) {
    return new NextResponse("Missing env (HUB_LINK_SECRET / APP_ID).", { status: 500 });
  }

  const token = req.nextUrl.searchParams.get("kch") ?? "";
  const ok = token ? verifyHubToken(token, secret, appId).ok : false;

  if (!ok) {
const to = new URL(lpUrl);
to.searchParams.set("from", appId); // appId=interview-pod
return NextResponse.redirect(to, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
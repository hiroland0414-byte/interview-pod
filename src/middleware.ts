// interview-pod/src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const APP_COOKIE = "kc_app_auth";
const MAX_AGE_DAYS = 60; // ← 運用に合わせて（kc-lp側と揃えるなら60）
const MAX_AGE = 60 * 60 * 24 * MAX_AGE_DAYS;

function isPublicAssetPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function b64urlToBytes(input: string): Uint8Array {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replaceAll("-", "+").replaceAll("_", "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

/**
 * token: v1.<payloadB64>.<sigB64>
 * payload: { appId, iat, exp }
 */
async function verifyHubTokenEdge(
  token: string,
  secret: string,
  expectedAppId: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, reason: "format" };
    const [ver, payloadB64, sigB64] = parts;
    if (ver !== "v1") return { ok: false, reason: "version" };

    const payloadBytes = b64urlToBytes(payloadB64);
    const payloadText = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadText) as { appId: string; iat: number; exp: number };

    if (payload.appId !== expectedAppId) return { ok: false, reason: "appId" };

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || now > payload.exp) return { ok: false, reason: "expired" };

    const expectedSig = await hmacSha256(secret, `${ver}.${payloadB64}`);
    const gotSig = b64urlToBytes(sigB64);

    const ok = timingSafeEqual(gotSig, expectedSig);
    return ok ? { ok: true } : { ok: false, reason: "sig" };
  } catch {
    return { ok: false, reason: "exception" };
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 静的アセットは通す（画像・CSSが死ぬのを防ぐ）
  if (isPublicAssetPath(pathname)) return NextResponse.next();

  const lpUrl = process.env.LP_URL ?? "https://kc-lp.vercel.app";
  const secret = process.env.HUB_LINK_SECRET ?? "";
  const appId = process.env.APP_ID ?? "";

  if (!secret || !appId) {
    return new NextResponse("Missing env (HUB_LINK_SECRET / APP_ID).", { status: 500 });
  }

  // ✅ すでに入場済みなら通す（Cookie運用）
  if (req.cookies.get(APP_COOKIE)?.value === "1") return NextResponse.next();

  // ✅ LPから来た “通行証(kch)” を検証
  const token = req.nextUrl.searchParams.get("kch") ?? "";
  const verifyResult = token
    ? await verifyHubTokenEdge(token, secret, appId)
    : { ok: false, reason: "no-token" as const };

  console.log("[kch-debug]", {
    ok: verifyResult.ok,
    reason: verifyResult.reason ?? "(none)",
    appId,
    path: pathname,
  });

  if (!verifyResult.ok) {
    const to = new URL(lpUrl);
    to.searchParams.set("from", appId);
    return NextResponse.redirect(to, 307);
  }

  // ✅ OK → Cookie発行して通す（次回以降 kch 無しでもOK）
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

export const config = {
  matcher: ["/:path*"],
};
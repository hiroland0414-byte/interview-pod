// src/lib/hubLink.ts
import crypto from "crypto";

type VerifyResult = { ok: boolean; reason?: string };

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function b64urlToBuffer(input: string) {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const s = input.replaceAll("-", "+").replaceAll("_", "/") + pad;
  return Buffer.from(s, "base64");
}

function hmac(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

/**
 * token: v1.<payloadB64>.<sigB64>
 * payload: { appId, iat, exp }
 */
export function verifyHubToken(token: string, secret: string, expectedAppId: string): VerifyResult {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, reason: "format" };
    const [ver, payloadB64, sigB64] = parts;
    if (ver !== "v1") return { ok: false, reason: "version" };

    const payloadBuf = b64urlToBuffer(payloadB64);
    const payload = JSON.parse(payloadBuf.toString("utf8")) as {
      appId: string;
      iat: number;
      exp: number;
    };

    if (payload.appId !== expectedAppId) return { ok: false, reason: "appId" };

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || now > payload.exp) return { ok: false, reason: "expired" };

    const expectedSig = hmac(secret, `${ver}.${payloadB64}`);
    const gotSig = b64urlToBuffer(sigB64);

    if (gotSig.length !== expectedSig.length) return { ok: false, reason: "siglen" };
    const ok = crypto.timingSafeEqual(gotSig, expectedSig);
    return ok ? { ok: true } : { ok: false, reason: "sig" };
  } catch {
    return { ok: false, reason: "exception" };
  }
}
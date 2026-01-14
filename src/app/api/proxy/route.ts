import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u = searchParams.get("u");
  if (!u) return NextResponse.json({ error: "u required" }, { status: 400 });
  try {
    const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "proxy failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    await req.json().catch(() => null);
  } catch {}
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "log endpoint is alive" });
}

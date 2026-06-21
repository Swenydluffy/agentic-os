import { NextResponse } from "next/server";

const PAPERCLIP_URL = "http://localhost:3100";

export async function GET() {
  try {
    const res = await fetch(`${PAPERCLIP_URL}/api/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    return NextResponse.json({ ok: true, url: PAPERCLIP_URL, ...data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

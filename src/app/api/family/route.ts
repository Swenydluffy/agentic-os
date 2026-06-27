import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const NOTES_URL = process.env.NOTES_SERVER_URL ?? "http://31.220.63.57:9120";
  const tok = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
  try {
    const r = await fetch(`${NOTES_URL}/api/family`, {
      headers: { "x-notes-token": tok },
      signal: AbortSignal.timeout(35000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, output: "" }, { status: 502 });
  }
}

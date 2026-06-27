import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NOTES_URL = process.env.NOTES_SERVER_URL ?? "http://31.220.63.57:9120";

export async function GET() {
  const tok = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
  try {
    const r = await fetch(`${NOTES_URL}/api/calendar`, {
      headers: { "x-notes-token": tok },
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg, events: [] }, { status: 502 });
  }
}

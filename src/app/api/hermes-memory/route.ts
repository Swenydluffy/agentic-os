import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns Hermes brain/memory fill % from VPS notes server
export async function GET() {
  const NOTES_URL = process.env.NOTES_SERVER_URL ?? "http://31.220.63.57:9120";
  const tok = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
  try {
    const res = await fetch(`${NOTES_URL}/api/hermes-memory`, {
      headers: { "x-notes-token": tok },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}

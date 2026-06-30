import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tok = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
  try {
    const res = await fetch("https://notes.wynneops.com/api/tg-messages", {
      cache: "no-store",
      headers: { "x-notes-token": tok },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: "HTTP " + res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}

import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const tok = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
  try {
    const res = await fetch("https://notes.wynneops.com/api/neurosync/status", {
      cache: "no-store",
      headers: { "x-notes-token": tok },
      signal: AbortSignal.timeout(8000),
    });
    const data = res.ok ? await res.json() : {};
    return NextResponse.json(
      { ok: true, total: data.total_intakes ?? 0, sources: [], recent: [], syncedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) { return NextResponse.json({ ok: false, error: String(e) }, { status: 502 }); }
}

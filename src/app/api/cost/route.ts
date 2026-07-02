import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const res = await fetch("https://notes.wynneops.com/api/cost", {
      cache: "no-store",
      headers: { "x-notes-token": process.env.NOTES_TOKEN ?? "notes-wynneops-2026" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ error: "HTTP " + res.status }, { status: res.status });
    return NextResponse.json(await res.json(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 502 }); }
}

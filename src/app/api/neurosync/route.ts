import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOK = () => process.env.NOTES_TOKEN ?? "notes-wynneops-2026";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? "10");
  try {
    const res = await fetch("https://notes.wynneops.com/api/neurosync/status", {
      cache: "no-store",
      headers: { "x-notes-token": TOK() },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "HTTP " + res.status }, { status: res.status });
    }
    const status = await res.json();
    const sources = (status.top_tags ?? []).slice(0, 6).map(([tag, count]: [string, number]) => ({
      source: tag,
      count,
      last: null,
    }));
    const recent = (status.valid_sources ?? []).slice(0, limit).map((src: string, i: number) => ({
      id: String(i),
      source: src,
      date: new Date().toISOString().slice(0, 10),
      snippet: src.replace(/_/g, " "),
    }));
    return NextResponse.json(
      { ok: true, total: status.total_intakes ?? 0, sources, recent, syncedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch("https://notes.wynneops.com/api/neurosync/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-notes-token": TOK() },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "HTTP " + res.status }, { status: res.status });
    }
    return NextResponse.json(await res.json(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}

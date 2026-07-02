import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TOK = () => process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
export async function GET() {
  try {
    const res = await fetch("https://notes.wynneops.com/api/model", {
      cache: "no-store", headers: { "x-notes-token": TOK() }, signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ error: "HTTP "+res.status }, { status: res.status });
    return NextResponse.json(await res.json(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 502 }); }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch("https://notes.wynneops.com/api/model", {
      method: "POST", headers: { "Content-Type": "application/json", "x-notes-token": TOK() },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ error: "HTTP "+res.status }, { status: res.status });
    return NextResponse.json(await res.json(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 502 }); }
}

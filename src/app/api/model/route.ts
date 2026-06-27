import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const NOTES_URL = process.env.NOTES_SERVER_URL ?? "http://31.220.63.57:9120";

export async function GET() {
  const tok = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
  try {
    const r = await fetch(`${NOTES_URL}/api/model`, {
      headers: { "x-notes-token": tok },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e), model: "unknown", provider: "unknown" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const tok = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
  try {
    const body = await req.json();
    const r = await fetch(`${NOTES_URL}/api/model`, {
      method: "POST",
      headers: { "x-notes-token": tok, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}

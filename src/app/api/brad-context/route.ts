import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = (process.env.NOTES_SERVER_URL || "http://31.220.63.57:9120") + "/api/brad-context";
  const tok = process.env.NOTES_TOKEN || "notes-wynneops-2026";
  try {
    const res = await fetch(url, { headers: { "x-notes-token": tok }, cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: false, error: "upstream " + res.status }, { status: 502 });
    const text = await res.text();
    return new NextResponse(text, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 502 });
  }
}

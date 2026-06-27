import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NOTES_URL = process.env.NOTES_SERVER_URL ?? "http://31.220.63.57:9120";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "name= required" }, { status: 400 });
  }
  try {
    const r = await fetch(`${NOTES_URL}/api/script/run?name=${encodeURIComponent(name)}`, {
      headers: { "x-notes-token": process.env.NOTES_TOKEN ?? "notes-wynneops-2026" },
      signal: AbortSignal.timeout(35000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public health probe — no auth required.
// Fetches from notes.wynneops.com/api/hermes/health (public endpoint, no token needed).
export async function GET() {
  try {
    const res = await fetch("https://notes.wynneops.com/api/hermes/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return NextResponse.json({ online: false, error: `HTTP ${res.status}` });
    const data = await res.json();
    return NextResponse.json({ online: true, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ online: false, error: msg });
  }
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = process.env.GATEWAY_KILL_TOKEN || "emergency-stop-2026";
    const authHeader = req.headers.get("x-gateway-kill-token");
    
    if (authHeader !== token) {
      return NextResponse.json(
        { error: "Unauthorized", killed: false },
        { status: 401 }
      );
    }

    const notesUrl = process.env.NOTES_SERVER_URL ?? "http://31.220.63.57:9120";
    const notesToken = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
    
    const res = await fetch(`${notesUrl}/api/gateway/kill`, {
      method: "POST",
      headers: {
        "x-notes-token": notesToken,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Notes server error: ${res.status}`, killed: false },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[GATEWAY KILL] Error:", e);
    return NextResponse.json(
      { error: String(e), killed: false },
      { status: 502 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CHAT_ID = "8669415558";

/**
 * Send Brad's message to Hermes via Telegram Bot API.
 * Hermes picks it up via polling and replies — the reply appears
 * in the MC panel automatically via the /api/tg-messages poll (every 5s).
 * No need to wait here — return immediately after send.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ ok: false, error: "No text" }, { status: 400 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: "Bot token not configured" }, { status: 500 });

  try {
    const res = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json({ ok: false, error: data.description ?? "Send failed" });
    }
    // Return immediately — Hermes reply will appear via /api/tg-messages poll
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

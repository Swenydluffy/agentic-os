import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/balance
 * Returns the real OpenRouter account credit balance.
 * Polls OpenRouter /api/v1/credits — updates after each completed request.
 */
export async function GET() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENROUTER_API_KEY not set" }, { status: 500 });
  }

  try {
    const r = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${apiKey}` },
      // No caching — always fresh
      cache: "no-store",
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => `HTTP ${r.status}`);
      return NextResponse.json({ ok: false, error: detail }, { status: 502 });
    }

    const data = await r.json() as {
      data?: { total_credits?: number; total_usage?: number };
    };

    const total_credits = data.data?.total_credits ?? 0;
    const total_usage   = data.data?.total_usage   ?? 0;
    const remaining     = Math.max(0, total_credits - total_usage);

    return NextResponse.json({
      ok: true,
      total_credits,
      total_usage,
      remaining,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

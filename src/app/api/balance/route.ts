import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const key = process.env.OPENROUTER_API_KEY ?? process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? "";
  if (!key) return NextResponse.json({ ok: false, error: "no key" }, { status: 500 });
  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      cache: "no-store",
      headers: { "Authorization": "Bearer " + key },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: "HTTP " + res.status }, { status: res.status });
    const data = await res.json();
    const remaining = (data.data?.total_credits ?? 0) - (data.data?.total_usage ?? 0);
    return NextResponse.json(
      { ok: true, remaining, total_credits: data.data?.total_credits, total_usage: data.data?.total_usage },
      { headers: { "Cache-Control": "no-store, no-cache" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}

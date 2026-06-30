import { NextRequest } from "next/server";
import { loadConfig } from "@/lib/config.server";
import { HermesError, sendHermesMessage, pingHermes } from "@/lib/hermes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// An agent run can take a while; allow a generous server-side budget.
export const maxDuration = 300;

/** LIVE/OFFLINE status — fetches notes.wynneops.com public health endpoint directly. */
export async function GET(_req: NextRequest) {
  try {
    const res = await fetch('https://notes.wynneops.com/api/hermes/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return Response.json({ ok: true, online: false, error: 'HTTP ' + res.status });
    }
    const data = await res.json();
    return Response.json({ ok: true, ...data });
  } catch (e) {
    return Response.json({ ok: true, online: false, error: String(e) });
  }
}

/** Route a chat message to the real Hermes server (not the Claude API). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) {
    return Response.json({ ok: false, error: "Missing message" }, { status: 400 });
  }

  const { hermes } = loadConfig();
  if (!hermes.url.trim()) {
    return Response.json(
      { ok: false, error: "Hermes is not configured. Set hermes.url in config.json (or HERMES_URL).", code: "unconfigured" },
      { status: 400 },
    );
  }

  try {
    const { reply, sessionId } = await sendHermesMessage(message, hermes);
    return Response.json({ ok: true, reply, sessionId });
  } catch (e: unknown) {
    if (e instanceof HermesError) {
      const status =
        e.code === "offline" ? 503 : e.code === "auth" ? 502 : e.code === "unconfigured" ? 400 : e.code === "timeout" ? 504 : 502;
      return Response.json({ ok: false, error: e.message, code: e.code }, { status });
    }
    const detail = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }
}

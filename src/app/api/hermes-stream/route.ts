import { NextRequest } from "next/server";
import { loadConfig } from "@/lib/config.server";
import { HermesError, sendHermesMessage } from "@/lib/hermes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Streaming SSE wrapper for Hermes chat.
 * Sends keepalive pings every 10s so the browser never sees a dead connection,
 * then delivers the full reply as a final SSE event.
 * Eliminates 504s on long agent runs.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) {
    return new Response(JSON.stringify({ ok: false, error: "Missing message" }), { status: 400 });
  }

  const { hermes } = loadConfig();
  if (!hermes.url.trim()) {
    return new Response(JSON.stringify({ ok: false, error: "Hermes not configured" }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { /* closed */ }
      }, 10_000);

      try {
        const { reply } = await sendHermesMessage(message, hermes);
        clearInterval(ping);
        controller.enqueue(encoder.encode("data: " + JSON.stringify({ ok: true, reply }) + "\n\n"));
      } catch (e: unknown) {
        clearInterval(ping);
        let errMsg = "Unknown error";
        let code = "offline";
        if (e instanceof HermesError) { errMsg = e.message; code = e.code; }
        else if (e instanceof Error) { errMsg = e.message; }
        controller.enqueue(encoder.encode("data: " + JSON.stringify({ ok: false, error: errMsg, code }) + "\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

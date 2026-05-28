import { NextRequest } from "next/server";
import { synthesizeEdgeTts, DEFAULT_VOICE } from "@/lib/edge-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CHARS = 5000;

/** Synthesize speech via Edge TTS. Returns audio/mpeg (MP3) on success. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { text?: string; voice?: string } | null;
  const text = body?.text?.trim();
  if (!text) return Response.json({ ok: false, error: "Missing text" }, { status: 400 });
  if (text.length > MAX_CHARS) {
    return Response.json({ ok: false, error: `Text too long (max ${MAX_CHARS} chars)` }, { status: 413 });
  }
  const voice = body?.voice?.trim() || DEFAULT_VOICE;

  try {
    const audio = await synthesizeEdgeTts(text, voice);
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}

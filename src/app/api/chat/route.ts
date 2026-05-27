import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingMessage = { role: "user" | "assistant"; content: string };

const DEMO_OPENERS: Record<string, string> = {
  Orchestrator: "On it — let me figure out who on the fleet should own this.",
  Researcher: "Good question. Let me reach for the sources.",
  Architect: "Let's think about the shape of this before we build it.",
  Coder: "Say less — I'm reaching for the keyboard.",
  Reviewer: "Let me put on my reviewer hat and look closely.",
  Tester: "My favorite question. Where could this break?",
  Sentinel: "Security lens engaged. Let me size up the risk.",
  Ops: "Roger. Let me line up the pipeline.",
  Memoria: "Let me check what the fleet already remembers about this.",
  Scout: "I'm scanning the signals now.",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const body = (await req.json().catch(() => null)) as {
    messages?: IncomingMessage[];
    system?: string;
    model?: string;
    agent?: string;
    agentName?: string;
  } | null;

  if (!body || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }

  const system =
    body.system ??
    `You are Claude, currently embedded as the central intelligence of a local mission-control dashboard called "C.M.C.". You coordinate a fleet of specialized AI agents on the user's machine. Respond with warmth, precision, and a hint of cinematic flair — think helpful copilot at a sci-fi command console. Keep responses tight unless detail is asked for.`;

  if (!apiKey) {
    const last = body.messages[body.messages.length - 1]?.content ?? "";
    const name = body.agentName ?? "Claude";
    const opener = DEMO_OPENERS[name] ?? `${name} here.`;
    const demo = `${opener}\n\nI caught: “${last.slice(0, 200)}” — and I'd love to actually run with it.\n\nI'm in demo mode right now (no API key). Drop a key into .env.local and I'll come fully online:\n  ANTHROPIC_API_KEY=sk-ant-…`;
    return streamPlainText(demo);
  }

  try {
    const client = new Anthropic({ apiKey });
    const model = body.model ?? "claude-sonnet-4-6";

    const stream = await client.messages.stream({
      model,
      max_tokens: 1024,
      system,
      messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          controller.enqueue(encoder.encode(`\n\n[stream error: ${msg}]`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}

function streamPlainText(text: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const ch of text) {
        controller.enqueue(encoder.encode(ch));
        await new Promise((r) => setTimeout(r, 8));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

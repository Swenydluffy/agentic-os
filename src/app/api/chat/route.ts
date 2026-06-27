import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { loadConfig } from "@/lib/config.server";
import {
  MODEL_OPTIONS,
  OPENAI_COMPAT_PROVIDERS,
  type ModelOption,
  type ProviderId,
} from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingMessage = { role: "user" | "assistant"; content: string };

const PROVIDERS: ReadonlySet<string> = new Set<string>([
  "anthropic",
  "openai",
  "google",
  "xai",
  "deepseek",
  "meta",
  "openrouter", // ← AI Console uses this to pass full model IDs (e.g. x-ai/grok-4.3)
]);

function isProvider(v: unknown): v is ProviderId {
  return typeof v === "string" && PROVIDERS.has(v as ProviderId);
}

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
    provider?: string;
    agent?: string;
    agentName?: string;
  } | null;

  if (!body || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }

  const provider = isProvider(body.provider) ? body.provider : "anthropic";

  const system =
    body.system ??
    `You are an AI assistant embedded in a local mission-control dashboard called "C.M.C.". You coordinate a fleet of specialized AI agents on the user's machine. Respond with warmth, precision, and a hint of cinematic flair — think helpful copilot at a sci-fi command console. Keep responses tight unless detail is asked for.`;

  // ── OpenRouter fast-path: AI Console passes full model IDs (e.g. x-ai/grok-4.3) ──
  if ((provider as string) === "openrouter") {
    return handleOpenRouter(body.messages, system, body.model);
  }

  // Non-Anthropic providers use OpenAI-compatible API via their own keys
  if (provider !== "anthropic") {
    return handleOpenAICompatible(provider as Exclude<ProviderId, "anthropic">, body.messages, system, body.model);
  }

  // ── Anthropic direct path ──────────────────────────────────────────────────
  if (!apiKey) {
    const last = body.messages[body.messages.length - 1]?.content ?? "";
    const name = body.agentName ?? "Claude";
    const opener = DEMO_OPENERS[name] ?? `${name} here.`;
    const demo = `${opener}\n\nI caught: "${last.slice(0, 200)}" — and I'd love to actually run with it.\n\nI'm in demo mode right now (no API key). Drop a key into .env.local and I'll come fully online:\n  ANTHROPIC_API_KEY=sk-…`;
    return streamPlainText(demo);
  }

  try {
    const client = new Anthropic({ apiKey });
    const model = body.model ?? loadConfig().models.sonnet;

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

/**
 * OpenRouter fast-path for AI Console.
 * Accepts the full model ID as-is (e.g. "x-ai/grok-4.3", "google/gemini-3.1-pro-preview").
 * Uses OPENROUTER_API_KEY — same key the Model Router rail uses.
 */
async function handleOpenRouter(
  messages: IncomingMessage[],
  system: string,
  modelId?: string,
) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = modelId?.trim() || "anthropic/claude-sonnet-4-5";

  if (!apiKey) {
    const last = messages[messages.length - 1]?.content ?? "";
    const demo = `OpenRouter not connected.\n\nI caught: "${last.slice(0, 200)}"\n\nAdd OPENROUTER_API_KEY to .env.local to enable all 7 console models.`;
    return streamPlainText(demo);
  }

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://mission.wynneops.com",
        "X-Title": "Mission Control AI Console",
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 1024,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => `HTTP ${upstream.status}`);
      return new Response(
        JSON.stringify({ error: `OpenRouter [${model}]: ${detail.slice(0, 500)}` }),
        { status: 502 },
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    const readable = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const frames = buffer.split("\n\n");
            buffer = frames.pop() ?? "";
            for (const frame of frames) {
              for (const line of frame.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const data = trimmed.slice(5).trim();
                if (data === "[DONE]") continue;
                try {
                  const json = JSON.parse(data) as {
                    choices?: Array<{ delta?: { content?: string } }>;
                  };
                  const text = json.choices?.[0]?.delta?.content;
                  if (text) controller.enqueue(encoder.encode(text));
                } catch {
                  /* skip keep-alives / partial frames */
                }
              }
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

/**
 * Stream a reply from an OpenAI-compatible provider (OpenAI, xAI, DeepSeek).
 */
async function handleOpenAICompatible(
  provider: Exclude<ProviderId, "anthropic">,
  messages: IncomingMessage[],
  system: string,
  requestedModel?: string,
) {
  const cfg = OPENAI_COMPAT_PROVIDERS[provider];
  const apiKey = process.env[cfg.envKey];
  const option: ModelOption =
    MODEL_OPTIONS.find((m) => m.provider === provider) ?? MODEL_OPTIONS[0];
  const model = requestedModel?.trim() || option.model;

  if (!apiKey) {
    const last = messages[messages.length - 1]?.content ?? "";
    const label =
      option.name === option.providerLabel
        ? option.name
        : `${option.name} (${option.providerLabel})`;
    const demo = `${label} selected.\n\nI caught: "${last.slice(0, 200)}" — and I'd love to actually run with it.\n\nThis provider isn't connected in this build (no API key). Add one to .env.local and ${option.name} comes fully online:\n  ${cfg.envKey}=…\n\nUntil then, Claude (Anthropic) is the wired-in default.`;
    return streamPlainText(demo);
  }

  try {
    const upstream = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        max_tokens: 1024,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => `HTTP ${upstream.status}`);
      return new Response(
        JSON.stringify({ error: `${option.providerLabel}: ${detail.slice(0, 500)}` }),
        { status: 502 },
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = upstream.body.getReader();

    const readable = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const frames = buffer.split("\n\n");
            buffer = frames.pop() ?? "";
            for (const frame of frames) {
              for (const line of frame.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const data = trimmed.slice(5).trim();
                if (data === "[DONE]") continue;
                try {
                  const json = JSON.parse(data) as {
                    choices?: Array<{ delta?: { content?: string } }>;
                  };
                  const text = json.choices?.[0]?.delta?.content;
                  if (text) controller.enqueue(encoder.encode(text));
                } catch {
                  /* skip keep-alives / partial frames */
                }
              }
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

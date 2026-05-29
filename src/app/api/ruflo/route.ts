import { NextRequest } from "next/server";
import { loadConfig } from "@/lib/config.server";
import { RufloError, getRufloStatus, launchTask, stopAllAgents } from "@/lib/ruflo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Launching a task creates a session and dispatches a prompt; allow some headroom.
export const maxDuration = 60;

/** Live swarm status + the agent list. Always 200 — `online:false` signals offline. */
export async function GET() {
  const { ruflo } = loadConfig();
  const status = await getRufloStatus(ruflo.url);
  return Response.json(status);
}

function statusForCode(code: RufloError["code"]): number {
  switch (code) {
    case "unconfigured":
      return 400;
    case "offline":
      return 503;
    case "auth":
      return 502;
    case "timeout":
      return 504;
    default:
      return 502;
  }
}

interface ActionBody {
  action?: string;
  prompt?: string;
}

/** Swarm actions: launch a new agent task, or stop all agents. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ActionBody | null;
  const action = body?.action;
  const { ruflo } = loadConfig();

  try {
    if (action === "launch") {
      const prompt = body?.prompt?.trim() ?? "";
      if (!prompt) {
        return Response.json({ ok: false, error: "Missing task prompt" }, { status: 400 });
      }
      const { sessionKey } = await launchTask(ruflo.url, prompt);
      return Response.json({ ok: true, sessionKey });
    }

    if (action === "stopAll") {
      const { stopped } = await stopAllAgents(ruflo.url);
      return Response.json({ ok: true, stopped });
    }

    return Response.json({ ok: false, error: `Unknown action: ${action ?? "(none)"}` }, { status: 400 });
  } catch (e: unknown) {
    if (e instanceof RufloError) {
      return Response.json({ ok: false, error: e.message, code: e.code }, { status: statusForCode(e.code) });
    }
    const detail = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }
}

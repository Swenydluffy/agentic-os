import { type ProviderId } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * All models now route through OpenRouter.
 * Availability = OPENROUTER_API_KEY is set and non-empty.
 */

export type ClaudeHealthReason =
  | "online"
  | "missing-key"
  | "bad-format"
  | "invalid-key"
  | "unreachable"
  | "error";

export interface ClaudeHealth {
  online: boolean;
  reason: ClaudeHealthReason;
}

export async function GET() {
  const orKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
  const hasKey = orKey.length > 0;

  // All providers share the OpenRouter key
  const available: Record<ProviderId, boolean> = {
    anthropic: hasKey,
    openai:    hasKey,
    google:    hasKey,
    xai:       hasKey,
    deepseek:  hasKey,
    meta:      hasKey,
  };

  // Surface a minimal claude health object for UI compatibility
  const claude: ClaudeHealth = {
    online: hasKey,
    reason: hasKey ? "online" : "missing-key",
  };

  return Response.json({ ok: true, available, claude });
}

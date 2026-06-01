import { OPENAI_COMPAT_PROVIDERS, type ProviderId } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anthropic Messages API — the endpoint a live Claude health check must hit. */
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
/** Pinned API version sent on every Anthropic request. */
const ANTHROPIC_VERSION = "2023-06-01";
/** Health-check model — the cheapest current Sonnet; only 1 token is requested. */
const HEALTH_CHECK_MODEL = "claude-sonnet-4-6";
/** Abort the probe if Anthropic doesn't answer quickly, so the panel never hangs. */
const HEALTH_CHECK_TIMEOUT_MS = 6000;

/**
 * Why a Claude card is (or isn't) online. Returned so the Models panel can show
 * a truthful, specific status instead of a bare "online/offline" guess.
 */
export type ClaudeHealthReason =
  | "online" // live request to Anthropic succeeded
  | "missing-key" // no ANTHROPIC_API_KEY in the environment
  | "bad-format" // key present but not a real Anthropic key (must start with sk-ant-)
  | "invalid-key" // Anthropic rejected the key (401/403)
  | "unreachable" // network error / timeout reaching Anthropic
  | "error"; // Anthropic answered with some other non-OK status

export interface ClaudeHealth {
  online: boolean;
  reason: ClaudeHealthReason;
}

/**
 * Live Claude health check: validate the key's format, then actually call the
 * Anthropic Messages API with the correct headers (`x-api-key`,
 * `anthropic-version`, `content-type`). Presence of the key is NOT enough — a
 * present-but-revoked key returns 401, which we surface as `invalid-key` rather
 * than falsely reporting "online". The key never leaves the server.
 */
async function checkClaude(): Promise<ClaudeHealth> {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  if (key.length === 0) return { online: false, reason: "missing-key" };
  if (!key.startsWith("sk-ant-")) return { online: false, reason: "bad-format" };

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: HEALTH_CHECK_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });

    if (res.ok) return { online: true, reason: "online" };
    if (res.status === 401 || res.status === 403) {
      return { online: false, reason: "invalid-key" };
    }
    return { online: false, reason: "error" };
  } catch {
    // Timeout, DNS failure, offline, etc.
    return { online: false, reason: "unreachable" };
  }
}

/**
 * Report per-provider availability for the Models panel. Claude (Anthropic) is
 * verified with a real round-trip to the API; the OpenAI-compatible providers
 * are reported as available when their key is present. Keys never leave the
 * server — only booleans and a coarse reason code are returned.
 */
export async function GET() {
  const claude = await checkClaude();

  const available: Record<ProviderId, boolean> = {
    anthropic: claude.online,
    openai: (process.env[OPENAI_COMPAT_PROVIDERS.openai.envKey] ?? "").length > 0,
    xai: (process.env[OPENAI_COMPAT_PROVIDERS.xai.envKey] ?? "").length > 0,
    deepseek: (process.env[OPENAI_COMPAT_PROVIDERS.deepseek.envKey] ?? "").length > 0,
    groq: (process.env[OPENAI_COMPAT_PROVIDERS.groq.envKey] ?? "").length > 0,
  };

  return Response.json({ ok: true, available, claude });
}

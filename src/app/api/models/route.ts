import { OPENAI_COMPAT_PROVIDERS, type ProviderId } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Report which providers have an API key configured, so the Models panel can
 * show a truthful status per card. Only booleans are returned — the keys
 * themselves never leave the server.
 */
export async function GET() {
  const available: Record<ProviderId, boolean> = {
    anthropic: (process.env.ANTHROPIC_API_KEY ?? "").length > 0,
    openai: (process.env[OPENAI_COMPAT_PROVIDERS.openai.envKey] ?? "").length > 0,
    xai: (process.env[OPENAI_COMPAT_PROVIDERS.xai.envKey] ?? "").length > 0,
    deepseek: (process.env[OPENAI_COMPAT_PROVIDERS.deepseek.envKey] ?? "").length > 0,
  };
  return Response.json({ ok: true, available });
}

import { loadConfig } from "@/lib/config.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Expose the resolved app configuration. The Hermes token is redacted — it is
 * server-only and must never reach the browser. */
export async function GET() {
  const config = loadConfig();
  const safe = {
    ...config,
    hermes: { url: config.hermes.url, configured: config.hermes.token.length > 0 },
  };
  return Response.json({ ok: true, config: safe });
}

import { loadConfig } from "@/lib/config.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Expose the resolved app configuration (vault location, models, agents, detected tools). */
export async function GET() {
  const config = loadConfig(true);
  return Response.json({ ok: true, config });
}

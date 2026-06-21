import { loadConfig, configPath } from "@/lib/config.server";
import { writeFileSync, readFileSync } from "node:fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = loadConfig();
  const safe = {
    ...config,
    hermes: { url: config.hermes.url, configured: config.hermes.token.length > 0 },
  };
  return Response.json({ ok: true, config: safe });
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    const hermes = typeof body.hermes === "object" && body.hermes !== null ? (body.hermes as Record<string, unknown>) : null;
    if (!hermes) return Response.json({ ok: false, error: "Missing hermes object" }, { status: 400 });
    const path = configPath();
    let current: Record<string, unknown> = {};
    try { current = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>; } catch { current = {}; }
    const currentHermes = typeof current.hermes === "object" && current.hermes !== null ? (current.hermes as Record<string, unknown>) : {};
    if (typeof hermes.url === "string") currentHermes.url = hermes.url.trim();
    if (typeof hermes.token === "string" && hermes.token.trim().length > 0) { currentHermes.token = hermes.token.trim(); }
    current.hermes = currentHermes;
    writeFileSync(path, JSON.stringify(current, null, 2), "utf8");
    const updated = loadConfig();
    return Response.json({ ok: true, config: { ...updated, hermes: { url: updated.hermes.url, configured: updated.hermes.token.length > 0 } } });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { parseVaultEntry, writeVaultEntry } from "@/lib/vault";
import { loadConfig } from "@/lib/config.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Persist a chat exchange, goal, or journal entry to the Obsidian vault. */
export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = parseVaultEntry(raw);

  if ("error" in parsed) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const { vault } = loadConfig();
    const result = await writeVaultEntry(parsed, vault.path, vault.folder);
    return Response.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

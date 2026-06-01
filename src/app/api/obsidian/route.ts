import { NextRequest } from "next/server";
import { listNotes, readNote, searchNotes, type ObsidianErrorCode } from "@/lib/obsidian";
import { parseMarkdownSave, writeVaultMarkdown } from "@/lib/vault";
import { loadConfig } from "@/lib/config.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusForCode(code?: ObsidianErrorCode): number {
  switch (code) {
    case "not-found":
      return 404;
    case "forbidden":
      return 403;
    case "no-vault":
      return 404;
    case "read-error":
    default:
      return 500;
  }
}

/**
 * GET /api/obsidian
 *   (no params)        → list all notes (newest-modified first)
 *   ?file=<rel/path.md> → that note's contents
 *   ?q=<query>         → full-text search across notes
 * Notes are served only from inside the configured vault (see lib/obsidian.ts).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const file = sp.get("file")?.trim();
  const q = sp.get("q")?.trim();

  if (file) {
    const result = await readNote(file);
    return Response.json(result, { status: result.ok ? 200 : statusForCode(result.code) });
  }
  if (q) {
    const result = await searchNotes(q);
    return Response.json(result, { status: result.ok ? 200 : statusForCode(result.code) });
  }
  const result = await listNotes();
  return Response.json(result, { status: result.ok ? 200 : statusForCode(result.code) });
}

/**
 * POST /api/obsidian
 *   { section, file, content, mode? } → save markdown to
 *   <vault>/Agentic OS/<section>/<file>.md
 *
 * The shared write primitive any panel can call to auto-save its state. Paths
 * are sanitized and confined to the Agentic OS folder (see lib/vault.ts).
 */
export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = parseMarkdownSave(raw);
  if ("error" in parsed) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  try {
    const { vault } = loadConfig();
    const result = await writeVaultMarkdown(parsed, vault.path, vault.folder);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

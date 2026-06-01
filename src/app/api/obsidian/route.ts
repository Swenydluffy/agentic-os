import { NextRequest } from "next/server";
import { listNotes, readNote, searchNotes, type ObsidianErrorCode } from "@/lib/obsidian";

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

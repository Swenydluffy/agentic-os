import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads intake stats from the server-side notes server
const NOTES_URL = process.env.NOTES_SERVER_URL ?? "http://31.220.63.57:9120";

interface IntakeItem {
  id: string;
  source: string;
  date: string;
  snippet: string;
}

interface SourceStat {
  source: string;
  count: number;
  last: string | null;
}

function parseIntakeMd(raw: string, filename: string): IntakeItem | null {
  try {
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    let source = "unknown";
    let date = "";
    let intakeId = filename.replace(/\.md$/, "");

    if (fmMatch) {
      const fm = fmMatch[1];
      const srcM = fm.match(/source:\s*(.+)/);
      const dateM = fm.match(/date:\s*(.+)/);
      const idM = fm.match(/intake_id:\s*(.+)/);
      if (srcM) source = srcM[1].trim();
      if (dateM) date = dateM[1].trim();
      if (idM) intakeId = idM[1].trim();
    }

    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
    let snippet = "";
    const transcriptMatch = body.match(/## Transcript\n([\s\S]*?)(?:\n##|$)/);
    if (transcriptMatch) {
      snippet = transcriptMatch[1].trim().slice(0, 140);
    } else {
      const lines = body.split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.length > 10);
      if (lines[0]) snippet = lines[0].slice(0, 140);
    }

    return { id: intakeId, source, date, snippet: snippet || "(no content)" };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "15", 10);

  try {
    // Fetch all notes from server, filter to Intake/ folder
    const notesRes = await fetch(`${NOTES_URL}/api/notes?limit=500`, {
      headers: { "x-notes-token": process.env.NOTES_TOKEN ?? "notes-wynneops-2026" },
      signal: AbortSignal.timeout(8000),
    });

    if (!notesRes.ok) {
      return Response.json({ ok: false, error: "Notes server unreachable", total: 0, sources: [], recent: [] }, { status: 502 });
    }

    const notesData = await notesRes.json() as { ok: boolean; notes: Array<{ path: string; name: string; mtime: string; modified: number }> };
    const allNotes = (notesData.notes ?? []).filter((n) => n.path.startsWith("Intake/"));

    // Sort newest first by modified (unix float)
    allNotes.sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0));

    // Source stats from filenames
    const statsMap: Record<string, { count: number; last: string | null; lastMod: number }> = {};
    for (const note of allNotes) {
      const match = note.name.match(/^Intake-([a-zA-Z_]+)-\d{4}/);
      const src = match ? match[1] : "unknown";
      if (!statsMap[src]) statsMap[src] = { count: 0, last: null, lastMod: 0 };
      statsMap[src].count++;
      if ((note.modified ?? 0) > statsMap[src].lastMod) {
        statsMap[src].lastMod = note.modified ?? 0;
        statsMap[src].last = note.mtime ?? null;
      }
    }

    const sources: SourceStat[] = Object.entries(statsMap).map(([source, s]) => ({
      source,
      count: s.count,
      last: s.last,
    }));

    // Fetch content for recent items
    const recentNotes = allNotes.slice(0, limit);
    const recent: IntakeItem[] = [];

    await Promise.all(
      recentNotes.map(async (note) => {
        try {
          const fileRes = await fetch(
            `${NOTES_URL}/api/notes?file=${encodeURIComponent(note.path)}`,
            { headers: { "x-notes-token": process.env.NOTES_TOKEN ?? "notes-wynneops-2026" }, signal: AbortSignal.timeout(5000) }
          );
          if (fileRes.ok) {
            const fd = await fileRes.json() as { content?: string };
            if (fd.content) {
              const item = parseIntakeMd(fd.content, note.name);
              if (item) recent.push(item);
            }
          }
        } catch { /* skip failed note */ }
      })
    );

    // Sort recent by date (they came in async)
    recent.sort((a, b) => b.date.localeCompare(a.date));

    return Response.json({
      ok: true,
      total: allNotes.length,
      totalNotes: notesData.notes?.length ?? 0,
      sources,
      recent: recent.slice(0, limit),
      syncedAt: allNotes[0]?.mtime ?? null,
    });

  } catch (err: unknown) {
    return Response.json(
      { ok: false, error: String(err), total: 0, sources: [], recent: [] },
      { status: 500 }
    );
  }
}

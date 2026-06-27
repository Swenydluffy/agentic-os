import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTES_URL = "https://notes.wynneops.com/api/notes";

const ALLOWED_DIRS = new Set(["DailyConversations", "Briefings", "Intake"]);
const MAX_NOTES = 100;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const file = sp.get("file")?.trim();
  const q = sp.get("q")?.trim();

  let url = NOTES_URL;
  if (file) url += "?file=" + encodeURIComponent(file);
  else if (q) url += "?q=" + encodeURIComponent(q);

  try {
    const resp = await fetch(url, {
      headers: { "x-notes-token": process.env.NOTES_TOKEN ?? "notes-wynneops-2026" },
      cache: "no-store",
    });
    const data = await resp.json();
    // Filter list call — exclude Memory-Dumps, allowed dirs only, cap at MAX_NOTES
    if (!file && !q && data.ok && Array.isArray(data.notes)) {
      data.notes = data.notes
        .filter((n: { name: string; dir: string }) =>
          !n.name.includes("Memory-Dump") &&
          ALLOWED_DIRS.has(n.dir)
        )
        .slice(0, MAX_NOTES);
    }
    return Response.json(data, { status: resp.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.section && body.file) body.file = `${body.section}/${body.file}.md`;
    const resp = await fetch(NOTES_URL, {
      method: "POST",
      headers: {
        "x-notes-token": process.env.NOTES_TOKEN ?? "notes-wynneops-2026",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await resp.json();
    return Response.json(data, { status: resp.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
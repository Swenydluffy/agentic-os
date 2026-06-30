import { NextRequest } from "next/server";
import { readJson, writeJson } from "@/lib/jsonstore";
import { writeFile as fsWrite, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "notes.json";
const NOTES_TOKEN="notes-wynneops-2026";

export interface Note {
  id: string; text: string; category: string;
  created_at: string; source: string; done: boolean; archived: boolean;
}
type Store = Note[];

function classifyCategory(text: string): string {
  const t = text.toLowerCase();
  if (/\b(remind|reminder|don't forget|remember to)\b/.test(t)) return "Reminders";
  if (/\b(todo|to-do|to do|task|need to|should|must|have to)\b/.test(t)) return "To-Do";
  if (/\b(idea|concept|what if|could|might|maybe|consider)\b/.test(t)) return "Ideas";
  if (/\b(project|build|launch|ship|deploy|develop|create)\b/.test(t)) return "Projects";
  if (/\b(feel|feeling|personal|family|life|health|mood)\b/.test(t)) return "Personal";
  return "General";
}

export async function GET() {
  const notes = await readJson<Store>(FILE, []);
  return Response.json({ ok: true, notes: notes.filter((n) => !n.archived) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const token  = req.headers.get("x-notes-token") ?? "";
  const same   = !origin || origin.includes("mission.wynneops.com") || origin.includes("localhost");
  if (!same && token !== NOTES_TOKEN)
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ ok: false, error: "text required" }, { status: 400 });

  const category = typeof body.category === "string" && body.category
    ? body.category : classifyCategory(text);

  const note: Note = {
    id: crypto.randomUUID(), text, category,
    created_at: new Date().toISOString(),
    source: typeof body.source === "string" ? body.source : "mc",
    done: false, archived: false,
  };
  const notes = await readJson<Store>(FILE, []);
  notes.push(note);
  await writeJson(FILE, notes);
  return Response.json({ ok: true, note });
}

export async function PATCH(req: NextRequest) {
  const body   = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id     = typeof body.id     === "string" ? body.id     : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!id || !["done","undone","archive"].includes(action))
    return Response.json({ ok: false, error: "id and action required" }, { status: 400 });

  const notes = await readJson<Store>(FILE, []);
  const idx   = notes.findIndex((n) => n.id === id);
  if (idx === -1)
    return Response.json({ ok: false, error: "not found" }, { status: 404 });

  if (action === "done")    notes[idx].done = true;
  if (action === "undone")  notes[idx].done = false;
  if (action === "archive") {
    notes[idx].archived = true;
    await archiveToVault(notes[idx]).catch(() => {});
  }
  await writeJson(FILE, notes);
  return Response.json({ ok: true, note: notes[idx] });
}

async function archiveToVault(note: Note): Promise<void> {
  const cfgPath = join(process.cwd(), "config.json");
  const { readFile } = await import("node:fs/promises");
  const cfg = JSON.parse(await readFile(cfgPath, "utf8")) as Record<string, unknown>;
  const vault = cfg?.vault as Record<string, unknown> | undefined;
  const vaultBase = typeof vault?.path === "string" ? vault.path : "";
  if (!vaultBase) return;
  const date = new Date(note.created_at).toISOString().slice(0, 10);
  const dir  = join(vaultBase, "Notes", note.category);
  await mkdir(dir, { recursive: true });
  const fname   = `${date}-${note.id.slice(0,8)}.md`;
  const content = `---\ntype: note\ncategory: ${note.category}\ncreated: ${note.created_at}\nsource: ${note.source}\ndone: ${note.done}\n---\n\n${note.text}\n`;
  await fsWrite(join(dir, fname), content, "utf8");
}

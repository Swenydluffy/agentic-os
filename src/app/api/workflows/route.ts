import { NextRequest } from "next/server";
import { readJson, writeJson } from "@/lib/jsonstore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "workflows.json";

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: string[];
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
}
interface Store {
  // Untrusted on read — each entry is coerced through toWorkflow().
  workflows: unknown[];
}

const EMPTY: Store = { workflows: [] };

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function steps(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is string => typeof s === "string");
}

/** Coerce an untrusted object into a Workflow, generating an id when absent. */
function toWorkflow(o: Record<string, unknown>): Workflow {
  return {
    id: str(o.id) || crypto.randomUUID(),
    name: str(o.name, "Untitled workflow"),
    description: str(o.description),
    steps: steps(o.steps),
    schedule: str(o.schedule, "Manual"),
    enabled: o.enabled === true,
    lastRun: typeof o.lastRun === "string" ? o.lastRun : null,
  };
}

async function load(): Promise<Workflow[]> {
  const store = await readJson<Store>(FILE, EMPTY);
  return Array.isArray(store.workflows)
    ? store.workflows
        .filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null)
        .map(toWorkflow)
    : [];
}

async function persist(workflows: Workflow[]) {
  await writeJson(FILE, { workflows });
}

/** GET /api/workflows → all workflows. */
export async function GET() {
  return Response.json({ ok: true, data: await load() });
}

/** POST /api/workflows → create a workflow (append). Body: a workflow object. */
export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  try {
    const workflows = await load();
    const created = toWorkflow({ ...raw, id: crypto.randomUUID() });
    workflows.push(created);
    await persist(workflows);
    return Response.json({ ok: true, data: workflows, created });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** PUT /api/workflows → patch a workflow by id (toggle, edit, or Run Now). */
export async function PUT(req: NextRequest) {
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = raw && typeof raw.id === "string" ? raw.id : "";
  if (!id) return Response.json({ ok: false, error: "A workflow id is required." }, { status: 400 });
  try {
    const workflows = await load();
    const idx = workflows.findIndex((w) => w.id === id);
    if (idx === -1) return Response.json({ ok: false, error: "Workflow not found." }, { status: 404 });
    workflows[idx] = toWorkflow({ ...workflows[idx], ...raw, id });
    await persist(workflows);
    return Response.json({ ok: true, data: workflows, updated: workflows[idx] });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** DELETE /api/workflows?id=<id> → remove a workflow. */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return Response.json({ ok: false, error: "A workflow id is required." }, { status: 400 });
  try {
    const workflows = (await load()).filter((w) => w.id !== id);
    await persist(workflows);
    return Response.json({ ok: true, data: workflows });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

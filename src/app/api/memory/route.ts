import { NextRequest } from "next/server";
import { readJson, writeJson } from "@/lib/jsonstore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = "memory.json";

export interface MemoryCard {
  id: string;
  title: string;
  content: string;
}
export interface MemoryStore {
  userProfile: MemoryCard[];
  agentMemory: MemoryCard[];
}

const EMPTY: MemoryStore = { userProfile: [], agentMemory: [] };

function asCards(v: unknown): MemoryCard[] {
  if (!Array.isArray(v)) return [];
  const out: MemoryCard[] = [];
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.title !== "string" || typeof o.content !== "string") continue;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
      title: o.title,
      content: o.content,
    });
  }
  return out;
}

/** GET /api/memory → the full memory store (user profile + agent memory). */
export async function GET() {
  const store = await readJson<MemoryStore>(FILE, EMPTY);
  return Response.json({
    ok: true,
    data: {
      userProfile: asCards(store.userProfile),
      agentMemory: asCards(store.agentMemory),
    },
  });
}

/** POST /api/memory → replace the store with the posted cards. */
export async function POST(req: NextRequest) {
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  const store: MemoryStore = {
    userProfile: asCards(raw.userProfile),
    agentMemory: asCards(raw.agentMemory),
  };
  try {
    await writeJson(FILE, store);
    return Response.json({ ok: true, data: store });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * Server-side reader for OMI wearable memories (server-only — never import from
 * the browser).
 *
 * The OMI app syncs its memory export into the Obsidian vault as
 * `<vault>/Omi/Memories.md`. There is no OMI cloud API key configured, so this
 * reads the synced export directly: it parses the bullet list into individual
 * memories, derives a lightweight category tag per memory, and exposes search /
 * filter. The export carries a single "Generated" timestamp (not per-memory
 * times), so "recent" is taken as the tail of the list (newest entries last).
 *
 * To wire the live OMI API later, add an `OMI_API_KEY` and swap `loadExport()`
 * for a fetch — the route/panel contract (OmiData) can stay the same.
 */
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "./config.server";

/** Where the OMI export lives inside the vault. Overridable for tests. */
function memoriesPath(): string {
  if (process.env.OMI_MEMORIES_PATH?.trim()) return process.env.OMI_MEMORIES_PATH.trim();
  return join(loadConfig().vault.path, "Omi", "Memories.md");
}

/** Derived category for a memory — keyword heuristic over the export text. */
export type OmiTag = "Preferences" | "Tech" | "Files" | "Chickens" | "General";

export const OMI_TAGS: readonly OmiTag[] = [
  "Preferences",
  "Tech",
  "Files",
  "Chickens",
  "General",
];

export interface OmiMemory {
  /** 1-based position in the export (higher = more recently added). */
  id: number;
  text: string;
  tag: OmiTag;
}

export interface OmiData {
  ok: true;
  /** Raw "Generated: …" line from the export header, if present. */
  generatedAt: string | null;
  /** Export file mtime as ISO — the best "synced at" signal we have. */
  syncedAt: string;
  /** Total memories parsed. */
  total: number;
  /** Memories in export order (oldest → newest). */
  memories: OmiMemory[];
  /** Tag → count over the whole export, for filter chips. */
  tagCounts: Record<OmiTag, number>;
}

export type OmiErrorCode = "missing-file" | "read-error";

export interface OmiError {
  ok: false;
  code: OmiErrorCode;
  error: string;
}

/** Classify a memory line into a category by keyword. Order matters. */
function tagFor(text: string): OmiTag {
  const t = text.toLowerCase();
  if (
    t.includes("downloads include") ||
    t.includes("local file") ||
    t.includes("recently modified") ||
    /\.(html?|pdf|zip|txt|csv|js|css|md|png|jpe?g)\b/.test(t)
  ) {
    return "Files";
  }
  if (/\b(chicken|hen|rooster|egg|coop|bantam|silkie|poultry|chick)\b/.test(t)) {
    return "Chickens";
  }
  if (
    /\b(api|key|token|server|code|coding|build|repo|swarm|agent|docker|deploy|terminal|claude|model|database|script|app|software|system)\b/.test(
      t,
    )
  ) {
    return "Tech";
  }
  if (
    /^(prefers|enjoys|values|dislikes|is allergic|tends|approaches|thinks|blends|has a|has an|is execution|is self|self-directed|likes|wants|prefer)/.test(
      t,
    )
  ) {
    return "Preferences";
  }
  return "General";
}

interface ParsedExport {
  generatedAt: string | null;
  memories: OmiMemory[];
  tagCounts: Record<OmiTag, number>;
}

/** Parse the markdown export: header meta + `- ` bullets → memories. */
function parseExport(markdown: string): ParsedExport {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let generatedAt: string | null = null;

  const memories: OmiMemory[] = [];
  const tagCounts: Record<OmiTag, number> = {
    Preferences: 0,
    Tech: 0,
    Files: 0,
    Chickens: 0,
    General: 0,
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (generatedAt === null && line.startsWith("Generated:")) {
      generatedAt = line.replace(/^Generated:\s*/, "").trim();
      continue;
    }
    // Memory bullets: "- text". Skip the trailing "## How to use this" prose.
    const m = /^-\s+(.*\S)\s*$/.exec(line);
    if (!m) continue;
    const text = m[1];
    const tag = tagFor(text);
    memories.push({ id: memories.length + 1, text, tag });
    tagCounts[tag] += 1;
  }

  return { generatedAt, memories, tagCounts };
}

/** Simple mtime-keyed cache so we don't re-parse 2k+ bullets every request. */
let cache: { mtimeMs: number; data: ParsedExport } | null = null;

/** Load + parse the export, returning a structured result (never throws). */
export async function loadOmi(): Promise<OmiData | OmiError> {
  const path = memoriesPath();

  let mtimeMs: number;
  let syncedAt: string;
  try {
    const s = await stat(path);
    mtimeMs = s.mtimeMs;
    syncedAt = s.mtime.toISOString();
  } catch {
    return {
      ok: false,
      code: "missing-file",
      error: `OMI export not found at ${path}. Make sure the OMI app is syncing to the vault.`,
    };
  }

  if (!cache || cache.mtimeMs !== mtimeMs) {
    try {
      const markdown = await readFile(path, "utf8");
      cache = { mtimeMs, data: parseExport(markdown) };
    } catch (e) {
      return { ok: false, code: "read-error", error: e instanceof Error ? e.message : String(e) };
    }
  }

  const { generatedAt, memories, tagCounts } = cache.data;
  return { ok: true, generatedAt, syncedAt, total: memories.length, memories, tagCounts };
}

export interface OmiQuery {
  /** Case-insensitive substring filter over memory text. */
  q?: string;
  /** Restrict to a single derived tag. */
  tag?: OmiTag;
  /** Max memories to return (default 10). */
  limit?: number;
}

export interface OmiQueryResult {
  ok: true;
  generatedAt: string | null;
  syncedAt: string;
  total: number;
  /** Count after q/tag filtering (before the limit is applied). */
  matched: number;
  tagCounts: Record<OmiTag, number>;
  /** Newest-first slice of the (filtered) memories, capped at `limit`. */
  memories: OmiMemory[];
}

/** Hard ceiling so a broad search can't return the entire export at once. */
const MAX_LIMIT = 100;

/**
 * Load the export and return a newest-first, filtered, limited slice. With no
 * query this is simply the last `limit` memories (the most recent ones).
 */
export async function queryOmi(opts: OmiQuery = {}): Promise<OmiQueryResult | OmiError> {
  const data = await loadOmi();
  if (!data.ok) return data;

  const q = opts.q?.trim().toLowerCase() ?? "";
  const tag = opts.tag;
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? 10));

  let filtered = data.memories;
  if (tag) filtered = filtered.filter((m) => m.tag === tag);
  if (q) filtered = filtered.filter((m) => m.text.toLowerCase().includes(q));

  // Newest first (the export appends new memories at the end), then cap.
  const memories = filtered.slice(-limit).reverse();

  return {
    ok: true,
    generatedAt: data.generatedAt,
    syncedAt: data.syncedAt,
    total: data.total,
    matched: filtered.length,
    tagCounts: data.tagCounts,
    memories,
  };
}

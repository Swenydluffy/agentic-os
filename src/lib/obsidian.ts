/**
 * Server-side reader for the Obsidian vault (server-only — never import from the
 * browser). Lists markdown notes, reads a single note's contents, and searches
 * note text. The vault root is the configured `vault.path` (config.json / env).
 *
 * SECURITY: `readNote` only ever serves `.md` files that resolve *inside* the
 * vault root — any path that escapes the root (via `..`, symlink, or absolute
 * path) is rejected, so the route can't be used to read arbitrary files.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, isAbsolute, extname, basename, dirname } from "node:path";
import { loadConfig } from "./config.server";

function vaultRoot(): string {
  return loadConfig().vault.path;
}

/** Directories we never descend into when listing/searching. */
const IGNORE_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);
/** Safety ceilings so a giant vault can't hang the request or the browser. */
const MAX_NOTES = 2000;
const MAX_NOTE_BYTES = 200 * 1024;
const MAX_SEARCH_MATCHES = 80;
const MAX_MATCHES_PER_FILE = 6;

export interface NoteMeta {
  /** Path relative to the vault root (forward slashes), the note's id. */
  path: string;
  /** Filename without extension. */
  name: string;
  /** Relative directory ("" for vault root). */
  dir: string;
  size: number;
  /** Modified time as ISO. */
  mtime: string;
}

export interface NoteContent {
  path: string;
  name: string;
  content: string;
  size: number;
  mtime: string;
  /** True when content was clipped at MAX_NOTE_BYTES. */
  truncated: boolean;
}

export interface SearchHit {
  path: string;
  name: string;
  matches: { line: number; text: string }[];
}

export type ObsidianErrorCode = "not-found" | "forbidden" | "read-error" | "no-vault";

export interface ObsidianError {
  ok: false;
  code: ObsidianErrorCode;
  error: string;
}

/** Recursively collect `.md` files under `dir`, pushing NoteMeta into `out`. */
async function walk(root: string, dir: string, out: NoteMeta[]): Promise<void> {
  if (out.length >= MAX_NOTES) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable dir — skip
  }
  for (const entry of entries) {
    if (out.length >= MAX_NOTES) return;
    if (entry.name.startsWith(".") && entry.isDirectory()) continue;
    if (IGNORE_DIRS.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, abs, out);
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      try {
        const s = await stat(abs);
        const rel = relative(root, abs).split("\\").join("/");
        out.push({
          path: rel,
          name: basename(entry.name, ".md"),
          dir: dirname(rel) === "." ? "" : dirname(rel),
          size: s.size,
          mtime: s.mtime.toISOString(),
        });
      } catch {
        // racing deletion — skip
      }
    }
  }
}

/** List every markdown note in the vault, newest-modified first. */
export async function listNotes(): Promise<{ ok: true; root: string; notes: NoteMeta[] } | ObsidianError> {
  const root = vaultRoot();
  try {
    await stat(root);
  } catch {
    return { ok: false, code: "no-vault", error: `Vault not found at ${root}.` };
  }
  const notes: NoteMeta[] = [];
  await walk(root, root, notes);
  notes.sort((a, b) => b.mtime.localeCompare(a.mtime));
  return { ok: true, root, notes };
}

/**
 * Resolve a vault-relative note path to an absolute path, rejecting anything
 * that escapes the vault or isn't a `.md` file. Returns null when unsafe.
 */
function safeResolve(root: string, relPath: string): string | null {
  if (!relPath || relPath.includes("\0")) return null;
  if (extname(relPath).toLowerCase() !== ".md") return null;
  const abs = join(root, relPath);
  const rel = relative(root, abs);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) return null;
  return abs;
}

/** Read a single note's contents (path must resolve inside the vault). */
export async function readNote(relPath: string): Promise<{ ok: true; note: NoteContent } | ObsidianError> {
  const root = vaultRoot();
  const abs = safeResolve(root, relPath);
  if (!abs) return { ok: false, code: "forbidden", error: "Invalid or out-of-vault note path." };

  let size: number;
  let mtime: string;
  try {
    const s = await stat(abs);
    if (!s.isFile()) return { ok: false, code: "not-found", error: "Not a file." };
    size = s.size;
    mtime = s.mtime.toISOString();
  } catch {
    return { ok: false, code: "not-found", error: `Note not found: ${relPath}` };
  }

  try {
    const full = await readFile(abs, "utf8");
    const truncated = full.length > MAX_NOTE_BYTES;
    const content = truncated
      ? full.slice(0, MAX_NOTE_BYTES) + "\n\n> _…note truncated for display._"
      : full;
    return {
      ok: true,
      note: { path: relPath, name: basename(relPath, ".md"), content, size, mtime, truncated },
    };
  } catch (e) {
    return { ok: false, code: "read-error", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Full-text search across all notes; returns per-file line matches (capped). */
export async function searchNotes(query: string): Promise<{ ok: true; hits: SearchHit[]; matched: number } | ObsidianError> {
  const q = query.trim().toLowerCase();
  if (!q) return { ok: true, hits: [], matched: 0 };

  const listed = await listNotes();
  if (!listed.ok) return listed;

  const hits: SearchHit[] = [];
  let total = 0;

  for (const note of listed.notes) {
    if (total >= MAX_SEARCH_MATCHES) break;
    const abs = safeResolve(listed.root, note.path);
    if (!abs) continue;
    let text: string;
    try {
      text = await readFile(abs, "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    const matches: { line: number; text: string }[] = [];
    for (let i = 0; i < lines.length && matches.length < MAX_MATCHES_PER_FILE; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        matches.push({ line: i + 1, text: lines[i].trim().slice(0, 240) });
        total += 1;
        if (total >= MAX_SEARCH_MATCHES) break;
      }
    }
    if (matches.length > 0) hits.push({ path: note.path, name: note.name, matches });
  }

  return { ok: true, hits, matched: total };
}

/**
 * Server-only persistence for the Notebook section (uses node:fs). Mirrors the
 * layout the operator asked for, all under the configured Agentic OS folder:
 *
 *   <vault>/<folder>/Notebooks/<notebook>/chat-YYYY-MM-DD.md   ← saved chats
 *   <vault>/<folder>/Notebooks/_assets/<notebook>/<file>        ← pulled artifacts
 *
 * `<notebook>` is a filesystem-safe folder derived from the notebook title
 * (falling back to its id). Asset reads for the file-serving endpoint are
 * resolved strictly inside the `_assets` root so a crafted request can't escape
 * the vault.
 */
import { mkdir, writeFile, appendFile, access, readdir, stat } from "node:fs/promises";
import { join, relative, isAbsolute, extname, basename } from "node:path";
import { loadConfig } from "./config.server";

/** Local YYYY-MM-DD so a "daily" chat file tracks the operator's day, not UTC. */
function localDateStamp(d: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTimeStamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Strip characters unsafe in macOS / Obsidian path segments. */
function sanitizeSegment(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\.+/, "") || ""
  );
}

/** Folder name for a notebook: sanitized title, or the id when the title is blank. */
export function notebookFolder(title: string | undefined, id: string): string {
  return sanitizeSegment(title ?? "") || sanitizeSegment(id) || "untitled";
}

/** `<vault>/<folder>/Notebooks` */
function notebooksRoot(): string {
  const cfg = loadConfig();
  return join(cfg.vault.path, cfg.vault.folder, "Notebooks");
}

/** `<vault>/<folder>/Notebooks/_assets` — the only dir the asset endpoint serves from. */
function assetsRoot(): string {
  return join(notebooksRoot(), "_assets");
}

/* --------------------------------- chat ----------------------------------- */

export interface ChatSaveResult {
  /** Path relative to the vault root, e.g. "Agentic OS/Notebooks/Foo/chat-2026-05-31.md". */
  relativePath: string;
  created: boolean;
}

function chatHeader(title: string, folder: string, dateStamp: string, date: Date): string {
  return [
    "---",
    `created: ${date.toISOString()}`,
    "tags:",
    "  - agentic-os",
    "  - notebook",
    "  - chat",
    "type: notebook-chat",
    `notebook: ${title || folder}`,
    "---",
    "",
    `# Notebook · ${title || folder} · ${dateStamp}`,
    "",
    "",
  ].join("\n");
}

function chatBlock(question: string, answer: string, date: Date): string {
  return [
    `## ${localTimeStamp(date)}`,
    "",
    `**You:** ${question.trim()}`,
    "",
    `**NotebookLM:** ${answer.trim()}`,
    "",
    "",
  ].join("\n");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Append one Q&A exchange to the notebook's daily chat file (creating it + header once). */
export async function appendNotebookChat(args: {
  notebookId: string;
  title: string;
  question: string;
  answer: string;
  timestamp?: number;
}): Promise<ChatSaveResult> {
  const date = new Date(args.timestamp ?? Date.now());
  const dateStamp = localDateStamp(date);
  const folder = notebookFolder(args.title, args.notebookId);
  const dir = join(notebooksRoot(), folder);
  const fileName = `chat-${dateStamp}.md`;
  const absPath = join(dir, fileName);
  const cfg = loadConfig();
  const relativePath = join(cfg.vault.folder, "Notebooks", folder, fileName);

  await mkdir(dir, { recursive: true });

  let created = false;
  try {
    // "wx" => create only if absent, so the header is written exactly once.
    await writeFile(absPath, chatHeader(args.title, folder, dateStamp, date), { flag: "wx" });
    created = true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
  await appendFile(absPath, chatBlock(args.question, args.answer, date), "utf8");
  return { relativePath, created };
}

/* -------------------------------- assets ---------------------------------- */

/** Per-artifact-type file extension. NotebookLM audio is AAC-in-MP4 — `.mp3` is
 *  rejected by the downloader, so audio is saved as `.m4a`. */
const ARTIFACT_EXT: Record<string, string> = {
  audio: "m4a",
  video: "mp4",
  slide_deck: "pdf",
  mind_map: "json",
  infographic: "png",
  flashcards: "html",
  quiz: "html",
  data_table: "csv",
  report: "md",
};

export const ARTIFACT_TYPES = Object.keys(ARTIFACT_EXT);

export function isArtifactType(v: unknown): v is string {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(ARTIFACT_EXT, v);
}

/** quiz/flashcards download as rendered HTML so the Assets tab can iframe them. */
export function downloadFormatFor(artifactType: string): string {
  return artifactType === "quiz" || artifactType === "flashcards" ? "html" : "json";
}

/**
 * Compute (and ensure the dir for) the absolute output path the MCP downloader
 * should write an artifact to. Returns both the absolute path (for the tool)
 * and the serving folder/file (for the client and the asset endpoint).
 */
export async function assetTarget(args: {
  notebookId: string;
  title: string;
  artifactType: string;
  artifactId: string;
}): Promise<{ outputPath: string; folder: string; file: string }> {
  const folder = notebookFolder(args.title, args.notebookId);
  const dir = join(assetsRoot(), folder);
  await mkdir(dir, { recursive: true });
  const ext = ARTIFACT_EXT[args.artifactType] ?? "bin";
  const shortId = sanitizeSegment(args.artifactId).slice(0, 8) || "latest";
  const file = `${args.artifactType}-${shortId}.${ext}`;
  return { outputPath: join(dir, file), folder, file };
}

export interface AssetFile {
  file: string;
  folder: string;
  ext: string;
  size: number;
  mtime: string;
  /** Range-capable serving URL for this file. */
  url: string;
}

/** List every downloaded artifact file for a notebook, newest first. */
export async function listAssets(notebookId: string, title: string): Promise<AssetFile[]> {
  const folder = notebookFolder(title, notebookId);
  const dir = join(assetsRoot(), folder);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // no assets dir yet
  }
  const out: AssetFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith(".")) continue;
    try {
      const s = await stat(join(dir, entry.name));
      out.push({
        file: entry.name,
        folder,
        ext: extname(entry.name).slice(1).toLowerCase(),
        size: s.size,
        mtime: s.mtime.toISOString(),
        url: `/api/notebook/asset?notebook=${encodeURIComponent(folder)}&file=${encodeURIComponent(entry.name)}`,
      });
    } catch {
      // racing deletion — skip
    }
  }
  out.sort((a, b) => b.mtime.localeCompare(a.mtime));
  return out;
}

/**
 * Resolve a (folder, file) pair to an absolute path STRICTLY inside the assets
 * root, rejecting traversal/absolute/escaping inputs. Returns null when unsafe.
 */
export function resolveAssetPath(folder: string, file: string): string | null {
  if (!folder || !file) return null;
  if (folder.includes("\0") || file.includes("\0")) return null;
  // file must be a bare name (no separators) and folder a single segment.
  if (/[\\/]/.test(file) || file === "." || file === "..") return null;
  if (/[\\/]/.test(folder)) return null;
  const root = assetsRoot();
  const abs = join(root, folder, file);
  const rel = relative(root, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  return abs;
}

/** MIME type for a file extension, used by the Range-capable asset endpoint. */
export function contentTypeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case "m4a":
    case "aac":
      return "audio/mp4";
    case "mp3":
      return "audio/mpeg";
    case "mp4":
      return "video/mp4";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "html":
      return "text/html; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    case "csv":
      return "text/csv; charset=utf-8";
    case "md":
      return "text/markdown; charset=utf-8";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export { basename };

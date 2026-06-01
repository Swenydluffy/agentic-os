/**
 * Obsidian vault persistence (server-only — uses node:fs).
 *
 * Writes chats, goals, and journal entries into an "Agentic OS" folder inside
 * the user's vault as Markdown. The target folder is created automatically.
 *
 * Write strategies differ by type:
 *  - chat    → APPEND: one file per day per agent; each exchange is appended.
 *  - goal    → REPLACE: one file per day rewritten as a checkbox task list
 *              reflecting the current goal set (so checking/editing stays in sync).
 *  - journal → REPLACE: one editable file per day holding the day's entry.
 *
 * This module has no Next.js dependencies so it can be unit-tested directly.
 */
import { mkdir, writeFile, appendFile, access } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";

// Date helpers are kept inline (not imported from ./date) so this server module
// stays self-contained and runnable directly by Node — see scripts/test-vault.ts.
// The client mirror lives in ./date.ts for use in browser components.
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local date as YYYY-MM-DD, so "daily" tracks the user's day, not UTC. */
export function localDateStamp(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTimeStamp(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export type VaultEntryType = "chat" | "goal" | "journal";

export interface ChatExchangeInput {
  type: "chat";
  /** Display name of the agent — drives the filename and per-agent tag. */
  agentName: string;
  userMessage: string;
  assistantMessage: string;
  /** Epoch ms for the exchange. Defaults to now. */
  timestamp?: number;
}

export interface GoalItem {
  text: string;
  done: boolean;
}

export interface GoalSnapshotInput {
  type: "goal";
  /** The full current goal list — written as a Markdown checkbox task list. */
  goals: GoalItem[];
  timestamp?: number;
}

export interface JournalEntryInput {
  type: "journal";
  /** The full text of the day's entry. */
  body: string;
  timestamp?: number;
}

export type VaultEntryInput =
  | ChatExchangeInput
  | GoalSnapshotInput
  | JournalEntryInput;

export interface VaultWriteResult {
  /** Absolute path of the file written. */
  path: string;
  /** Path relative to the vault root (e.g. "Agentic OS/Goals/Goals - 2026-05-27.md"). */
  relativePath: string;
  /** True if the file was created by this write, false if it already existed. */
  created: boolean;
}

const SUBFOLDER: Record<VaultEntryType, string> = {
  chat: "Chats",
  goal: "Goals",
  journal: "Journal",
};

/** Lowercase, hyphenated tag value (e.g. "Sentinel" -> "sentinel"). */
export function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Strip characters that are unsafe in file names on macOS / Obsidian. */
function sanitizeFileSegment(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim() || "untitled"
  );
}

function fileNameFor(entry: VaultEntryInput, dateStamp: string): string {
  switch (entry.type) {
    case "chat":
      return `${sanitizeFileSegment(entry.agentName)} - ${dateStamp}.md`;
    case "goal":
      return `Goals - ${dateStamp}.md`;
    case "journal":
      return `Journal - ${dateStamp}.md`;
  }
}

function tagsFor(entry: VaultEntryInput): string[] {
  const tags = ["agentic-os", entry.type];
  if (entry.type === "chat") tags.push(slugifyTag(entry.agentName));
  return tags;
}

function frontmatterLines(
  entry: VaultEntryInput,
  dateField: "created" | "updated",
  date: Date,
): string[] {
  return [
    "---",
    `${dateField}: ${date.toISOString()}`,
    "tags:",
    ...tagsFor(entry).map((t) => `  - ${t}`),
    `type: ${entry.type}`,
  ];
}

/** Chat header (frontmatter + title), written once when the daily file is created. */
function chatHeader(entry: ChatExchangeInput, date: Date, dateStamp: string): string {
  return [
    ...frontmatterLines(entry, "created", date),
    `agent: ${entry.agentName}`,
    "---",
    "",
    `# Chat · ${entry.agentName} · ${dateStamp}`,
    "",
    "",
  ].join("\n");
}

/** The markdown block appended for a single chat exchange. */
function chatBlock(entry: ChatExchangeInput, date: Date): string {
  return [
    `## ${localTimeStamp(date)}`,
    "",
    `**You:** ${entry.userMessage.trim()}`,
    "",
    `**${entry.agentName}:** ${entry.assistantMessage.trim()}`,
    "",
    "",
  ].join("\n");
}

/** Full-file rendering for goal/journal snapshots (replace mode). */
function renderSnapshot(
  entry: GoalSnapshotInput | JournalEntryInput,
  date: Date,
  dateStamp: string,
): string {
  const lines = [...frontmatterLines(entry, "updated", date), "---", ""];

  if (entry.type === "goal") {
    lines.push(`# Goals · ${dateStamp}`, "");
    const items = entry.goals.filter((g) => g.text.trim().length > 0);
    if (items.length === 0) {
      lines.push("_No goals yet._", "");
    } else {
      for (const g of items) {
        lines.push(`- [${g.done ? "x" : " "}] ${g.text.trim()}`);
      }
      lines.push("");
    }
  } else {
    lines.push(`# Journal · ${dateStamp}`, "");
    const body = entry.body.trim();
    lines.push(body.length > 0 ? body : "_Empty entry._", "");
  }

  return lines.join("\n");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write one entry to the vault. Creates the folder and daily file as needed.
 * Chats append; goals and journals replace the day's file with the current state.
 *
 * The vault location is passed in (resolved from config by the caller) so this
 * module stays free of config/fs-config dependencies and remains directly testable.
 */
export async function writeVaultEntry(
  entry: VaultEntryInput,
  vaultRoot: string,
  vaultFolder: string,
): Promise<VaultWriteResult> {
  const date = new Date(entry.timestamp ?? Date.now());
  const dateStamp = localDateStamp(date);

  const subfolder = SUBFOLDER[entry.type];
  const dir = join(vaultRoot, vaultFolder, subfolder);
  const fileName = fileNameFor(entry, dateStamp);
  const absPath = join(dir, fileName);
  const relativePath = join(vaultFolder, subfolder, fileName);

  await mkdir(dir, { recursive: true });

  if (entry.type === "chat") {
    let created = false;
    try {
      // "wx" => create only if absent, so the header is never duplicated.
      await writeFile(absPath, chatHeader(entry, date, dateStamp), { flag: "wx" });
      created = true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
    await appendFile(absPath, chatBlock(entry, date), "utf8");
    return { path: absPath, relativePath, created };
  }

  // goal + journal: rewrite the day's file with the current snapshot.
  const existed = await fileExists(absPath);
  await writeFile(absPath, renderSnapshot(entry, date, dateStamp), "utf8");
  return { path: absPath, relativePath, created: !existed };
}

/**
 * Write the guide to `<vault>/<folder>/Guide.md` (overwrite), prepending
 * Obsidian frontmatter with #agentic-os #guide tags.
 */
export async function writeGuide(
  markdown: string,
  vaultRoot: string,
  vaultFolder: string,
): Promise<VaultWriteResult> {
  const dir = join(vaultRoot, vaultFolder);
  const absPath = join(dir, "Guide.md");
  const relativePath = join(vaultFolder, "Guide.md");

  await mkdir(dir, { recursive: true });

  const frontmatter = [
    "---",
    `updated: ${new Date().toISOString()}`,
    "tags:",
    "  - agentic-os",
    "  - guide",
    "type: guide",
    "---",
    "",
    "",
  ].join("\n");

  const existed = await fileExists(absPath);
  await writeFile(absPath, frontmatter + markdown.trim() + "\n", "utf8");
  return { path: absPath, relativePath, created: !existed };
}

/* -------------------- generic markdown save (any panel) -------------------- */

/**
 * A free-form markdown save targeting `<vault>/<folder>/<section>/<file>.md`.
 * This is the shared primitive any panel can use to sync its state to the vault
 * (Kanban boards, future panels, etc.) without a bespoke entry type.
 */
export interface MarkdownSaveInput {
  /** Subfolder under the Agentic OS folder, e.g. "Kanban". */
  section: string;
  /** File name (with or without a trailing ".md"), e.g. "board". */
  file: string;
  /** Full markdown content to write. */
  content: string;
  /** "replace" (default) rewrites the file; "append" adds to it. */
  mode?: "replace" | "append";
}

/** Ceiling so a runaway client can't write an enormous file into the vault. */
const MAX_MARKDOWN_BYTES = 1_000_000;

/**
 * Write arbitrary markdown into the vault under a sanitized section/file path.
 * Section and file are reduced to safe single segments, and the resolved path
 * is asserted to stay inside `<vault>/<folder>` so a crafted name can't escape.
 */
export async function writeVaultMarkdown(
  input: MarkdownSaveInput,
  vaultRoot: string,
  vaultFolder: string,
): Promise<VaultWriteResult> {
  const section = sanitizeFileSegment(input.section);
  let file = sanitizeFileSegment(input.file);
  if (!/\.md$/i.test(file)) file += ".md";

  const base = join(vaultRoot, vaultFolder);
  const dir = join(base, section);
  const absPath = join(dir, file);

  // Containment guard: the target must resolve inside the Agentic OS folder.
  const rel = relative(base, absPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Refusing to write outside the vault folder.");
  }

  const relativePath = join(vaultFolder, section, file);
  await mkdir(dir, { recursive: true });

  const existed = await fileExists(absPath);
  if (input.mode === "append") {
    await appendFile(absPath, input.content, "utf8");
  } else {
    await writeFile(absPath, input.content, "utf8");
  }
  return { path: absPath, relativePath, created: !existed };
}

/** Validate an untrusted markdown-save body, or return an error. */
export function parseMarkdownSave(raw: unknown): MarkdownSaveInput | VaultParseError {
  if (typeof raw !== "object" || raw === null) {
    return { error: "Request body must be a JSON object" };
  }
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.section)) return { error: "section is required" };
  if (!isNonEmptyString(o.file)) return { error: "file is required" };
  if (typeof o.content !== "string") return { error: "content must be a string" };
  if (o.content.length > MAX_MARKDOWN_BYTES) return { error: "content is too large" };
  const mode = o.mode === "append" ? "append" : "replace";
  return { section: o.section, file: o.file, content: o.content, mode };
}

export interface VaultParseError {
  error: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validate an untrusted request body into a VaultEntryInput, or return an error.
 * Keeps validation at the system boundary so writeVaultEntry stays total.
 */
export function parseVaultEntry(raw: unknown): VaultEntryInput | VaultParseError {
  if (typeof raw !== "object" || raw === null) {
    return { error: "Request body must be a JSON object" };
  }
  const o = raw as Record<string, unknown>;
  const timestamp = typeof o.timestamp === "number" ? o.timestamp : undefined;

  switch (o.type) {
    case "chat": {
      if (!isNonEmptyString(o.agentName)) return { error: "chat requires a non-empty agentName" };
      if (typeof o.userMessage !== "string") return { error: "chat requires userMessage" };
      if (typeof o.assistantMessage !== "string") return { error: "chat requires assistantMessage" };
      return {
        type: "chat",
        agentName: o.agentName,
        userMessage: o.userMessage,
        assistantMessage: o.assistantMessage,
        timestamp,
      };
    }
    case "goal": {
      if (!Array.isArray(o.goals)) return { error: "goal requires a goals array" };
      const goals: GoalItem[] = [];
      for (const item of o.goals) {
        if (typeof item !== "object" || item === null) return { error: "each goal must be an object" };
        const g = item as Record<string, unknown>;
        if (typeof g.text !== "string") return { error: "each goal requires a text string" };
        goals.push({ text: g.text, done: g.done === true });
      }
      return { type: "goal", goals, timestamp };
    }
    case "journal": {
      if (typeof o.body !== "string") return { error: "journal requires a body string" };
      return { type: "journal", body: o.body, timestamp };
    }
    default:
      return { error: `Unknown or missing entry type: ${String(o.type)}` };
  }
}

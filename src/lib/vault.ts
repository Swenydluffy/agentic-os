/**
 * Obsidian vault persistence (server-only — uses node:fs).
 *
 * Writes chats, goals, and journal entries into an "Agentic OS" folder inside
 * the user's vault as Markdown. One file per day per agent (chats) or per day
 * (goals/journal); new exchanges append to the existing daily file. The target
 * folder is created automatically.
 *
 * This module has no Next.js dependencies so it can be unit-tested directly.
 */
import { mkdir, writeFile, appendFile, access } from "node:fs/promises";
import { join } from "node:path";

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

export interface GoalEntryInput {
  type: "goal";
  title: string;
  details?: string;
  status?: string;
  timestamp?: number;
}

export interface JournalEntryInput {
  type: "journal";
  title?: string;
  body: string;
  mood?: string;
  timestamp?: number;
}

export type VaultEntryInput =
  | ChatExchangeInput
  | GoalEntryInput
  | JournalEntryInput;

export interface VaultWriteResult {
  /** Absolute path of the file written. */
  path: string;
  /** Path relative to the vault root (e.g. "Agentic OS/Chats/Coder - 2026-05-27.md"). */
  relativePath: string;
  /** True if the file was created by this write, false if it already existed. */
  created: boolean;
}

export interface VaultConfig {
  root: string;
  folder: string;
}

/** Default vault location — overridable via env for testing or relocation. */
const DEFAULT_VAULT_ROOT = "/Users/lucyanne/Documents/Omi";
const DEFAULT_FOLDER = "Agentic OS";

const SUBFOLDER: Record<VaultEntryType, string> = {
  chat: "Chats",
  goal: "Goals",
  journal: "Journal",
};

/** Resolve the vault config at call time so env overrides always apply. */
export function getVaultConfig(): VaultConfig {
  return {
    root: process.env.OBSIDIAN_VAULT_PATH?.trim() || DEFAULT_VAULT_ROOT,
    folder: process.env.AGENTIC_OS_FOLDER?.trim() || DEFAULT_FOLDER,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local calendar date, so "daily" tracks the user's day, not UTC. */
export function localDateStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTimeStamp(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

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

/** YAML frontmatter + H1 title, written exactly once when the file is created. */
function header(entry: VaultEntryInput, date: Date, dateStamp: string): string {
  const lines: string[] = [
    "---",
    `created: ${date.toISOString()}`,
    "tags:",
    ...tagsFor(entry).map((t) => `  - ${t}`),
    `type: ${entry.type}`,
  ];
  if (entry.type === "chat") lines.push(`agent: ${entry.agentName}`);
  lines.push("---", "");

  const title =
    entry.type === "chat"
      ? `# Chat · ${entry.agentName} · ${dateStamp}`
      : entry.type === "goal"
        ? `# Goals · ${dateStamp}`
        : `# Journal · ${dateStamp}`;
  lines.push(title, "", "");
  return lines.join("\n");
}

/** The markdown block appended for a single entry/exchange. */
function entryBlock(entry: VaultEntryInput, date: Date): string {
  const time = localTimeStamp(date);
  switch (entry.type) {
    case "chat":
      return [
        `## ${time}`,
        "",
        `**You:** ${entry.userMessage.trim()}`,
        "",
        `**${entry.agentName}:** ${entry.assistantMessage.trim()}`,
        "",
        "",
      ].join("\n");
    case "goal": {
      const parts = [`## ${time} · ${entry.title.trim()}`, ""];
      if (entry.status?.trim()) parts.push(`- **Status:** ${entry.status.trim()}`, "");
      if (entry.details?.trim()) parts.push(entry.details.trim(), "");
      parts.push("");
      return parts.join("\n");
    }
    case "journal": {
      const heading = entry.title?.trim()
        ? `## ${time} · ${entry.title.trim()}`
        : `## ${time}`;
      const parts = [heading, ""];
      if (entry.mood?.trim()) parts.push(`> Mood: ${entry.mood.trim()}`, "");
      parts.push(entry.body.trim(), "", "");
      return parts.join("\n");
    }
  }
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
 * Write one entry to the vault. Creates the folder and daily file if missing,
 * writes the header once (race-safe via the "wx" flag), then appends the entry.
 */
export async function writeVaultEntry(
  entry: VaultEntryInput,
): Promise<VaultWriteResult> {
  const cfg = getVaultConfig();
  const date = new Date(entry.timestamp ?? Date.now());
  const dateStamp = localDateStamp(date);

  const subfolder = SUBFOLDER[entry.type];
  const dir = join(cfg.root, cfg.folder, subfolder);
  const fileName = fileNameFor(entry, dateStamp);
  const absPath = join(dir, fileName);
  const relativePath = join(cfg.folder, subfolder, fileName);

  await mkdir(dir, { recursive: true });

  let created = false;
  try {
    // "wx" => create only if it doesn't exist, so the header is never duplicated.
    await writeFile(absPath, header(entry, date, dateStamp), { flag: "wx" });
    created = true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }

  await appendFile(absPath, entryBlock(entry, date), "utf8");
  return { path: absPath, relativePath, created };
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
      if (!isNonEmptyString(o.title)) return { error: "goal requires a non-empty title" };
      return {
        type: "goal",
        title: o.title,
        details: typeof o.details === "string" ? o.details : undefined,
        status: typeof o.status === "string" ? o.status : undefined,
        timestamp,
      };
    }
    case "journal": {
      if (!isNonEmptyString(o.body)) return { error: "journal requires a non-empty body" };
      return {
        type: "journal",
        title: typeof o.title === "string" ? o.title : undefined,
        body: o.body,
        mood: typeof o.mood === "string" ? o.mood : undefined,
        timestamp,
      };
    }
    default:
      return { error: `Unknown or missing entry type: ${String(o.type)}` };
  }
}

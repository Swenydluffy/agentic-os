/**
 * Server-only wrapper around the `nlm` (NotebookLM Tools) CLI. The dashboard's
 * NotebookLM panel never touches the binary directly — it calls `/api/notebooklm`,
 * which calls these helpers. Each helper shells out with `execFile` (no shell, so
 * no injection surface) and returns a discriminated result the route can forward.
 *
 * Note: the CLI exits 0 even on auth/usage errors and prints a human-readable
 * banner instead of JSON. We therefore treat "stdout did not parse as JSON" as a
 * surfaced error and clean the banner into a one-line message for the UI.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

/** Generic result of an nlm invocation. */
export type NlmResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Candidate locations for the nlm binary, highest priority first. */
function candidates(): string[] {
  const home = homedir();
  return [
    process.env.NLM_BIN,
    join(home, ".local", "bin", "notebooklm-mcp"),
    join(home, ".local", "bin", "nlm"),
    "/Library/Frameworks/Python.framework/Versions/3.11/bin/nlm",
    "/usr/local/bin/nlm",
    "/opt/homebrew/bin/nlm",
  ].filter((p): p is string => Boolean(p));
}

let cachedBin: string | null = null;

/** Resolve the nlm binary once, falling back to a bare `nlm` PATH lookup. */
function resolveBin(): string {
  if (cachedBin) return cachedBin;
  for (const c of candidates()) {
    if (existsSync(c)) {
      cachedBin = c;
      return c;
    }
  }
  cachedBin = "nlm";
  return cachedBin;
}

/** Augment PATH so a bare `nlm` lookup can still find common install dirs. */
function augmentedPath(): string {
  const extra = [
    "/Library/Frameworks/Python.framework/Versions/3.11/bin",
    "/usr/local/bin",
    "/opt/homebrew/bin",
    join(homedir(), ".local", "bin"),
  ];
  return [process.env.PATH ?? "", ...extra].filter(Boolean).join(":");
}

/** Strip ANSI codes / box glyphs and collapse a CLI banner to one line. */
function cleanCliText(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/\[[0-9;]*m/g, "")
    .replace(/[│╭╮╰╯─✗✓→•]/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" — ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface ExecError {
  stdout?: string;
  stderr?: string;
  message?: string;
  killed?: boolean;
}

/** Run `nlm <args>` and parse stdout as JSON, surfacing banners as errors. */
async function runJson<T>(args: string[], timeoutMs = 130_000): Promise<NlmResult<T>> {
  const bin = resolveBin();
  try {
    const { stdout } = await execFileAsync(bin, args, {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, PATH: augmentedPath() },
    });
    const text = stdout.trim();
    if (!text) return { ok: false, error: "nlm returned no output." };
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return {
        ok: false,
        error: cleanCliText(text) || "nlm returned output that was not JSON.",
      };
    }
  } catch (e: unknown) {
    const err = e as ExecError;
    if (err.killed) {
      return { ok: false, error: "nlm timed out. The notebook may be large or busy." };
    }
    const detail =
      cleanCliText(err.stdout ?? "") ||
      cleanCliText(err.stderr ?? "") ||
      err.message ||
      "nlm failed to run.";
    const notFound = /ENOENT|not found|command not found/i.test(detail);
    return {
      ok: false,
      error: notFound
        ? "nlm CLI not found. Install it or set NLM_BIN to its path."
        : detail,
    };
  }
}

/** Raw JSON value returned by the CLI (intentionally loose — shapes vary). */
export type NlmJson = unknown;

/** `nlm list notebooks --json` */
export function listNotebooks(): Promise<NlmResult<NlmJson>> {
  return runJson(["list", "notebooks", "--json"], 30_000);
}

/** `nlm list sources <notebook> --json` */
export function listSources(notebook: string): Promise<NlmResult<NlmJson>> {
  return runJson(["list", "sources", notebook, "--json"], 60_000);
}

/** `nlm list artifacts <notebook> --json` */
export function listArtifacts(notebook: string): Promise<NlmResult<NlmJson>> {
  return runJson(["list", "artifacts", notebook, "--json"], 60_000);
}

/** `nlm query notebook <notebook> <question> --json` */
export function chatNotebook(
  notebook: string,
  question: string,
): Promise<NlmResult<NlmJson>> {
  return runJson(["query", "notebook", notebook, question, "--json"], 130_000);
}

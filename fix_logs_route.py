#!/usr/bin/env python3
"""
fix_logs_route.py
Four targeted changes to:
  ~/claude-mission-control/src/app/api/logs/route.ts

1. Replace CRON_DIR + MAX_OUTPUT constants with NOTES_URL + NOTES_TOKEN
2. Replace old readCronLogs() body with new fetch() version
3. Remove unused readdir/readFile/stat/join/homedir imports
4. Leave everything else untouched

Safety: aborts if any anchor is not found exactly once. Nothing written
until all checks pass. Prints unified diff, then writes backup + patch.
"""

from pathlib import Path
import sys, difflib

TARGET = Path.home() / "claude-mission-control/src/app/api/logs/route.ts"
BAK    = Path.home() / "claude-mission-control/src/app/api/logs/route.ts.bak.fix_logs_route"

# ── Anchors ────────────────────────────────────────────────────────────────────

# Change 1 — constants block
OLD_CONSTS = """\
const CRON_DIR = join(homedir(), "cron", "output");
const MAX_OUTPUT = 4000;\
"""
NEW_CONSTS = """\
const NOTES_URL   = process.env.NOTES_SERVER_URL ?? "https://notes.wynneops.com";
const NOTES_TOKEN=proces...OKEN ?? "notes-wynneops-2026";\
"""

# Change 2 — full readCronLogs function (JSDoc + body)
# Matches the two-branch isFile/isDirectory version applied by fix_cron_logs.py
OLD_FN = """\
/** Read each file in ~/cron/output/ as a cron job log; fall back to samples. */
async function readCronLogs(): Promise<CronLog[]> {
  let entries: string[];
  try {
    entries = (await readdir(CRON_DIR)).filter((f) => !f.startsWith("."));
  } catch {
    return SAMPLE_CRON;
  }
  if (entries.length === 0) return SAMPLE_CRON;

  const logs: CronLog[] = [];
  for (const name of entries.slice(0, 50)) {
    const abs = join(CRON_DIR, name);
    try {
      const s = await stat(abs);

      if (s.isFile()) {
        // ── existing behaviour: flat file in output/ ──────────────────────
        const text = await readFile(abs, "utf8");
        const output = text.length > MAX_OUTPUT ? text.slice(-MAX_OUTPUT) : text;
        const status: CronLog["status"] = /error|fail|traceback|exception/i.test(output)
          ? "error"
          : "ok";
        logs.push({ name, lastRun: s.mtime.toISOString(), status, output: output.trim() });

      } else if (s.isDirectory()) {
        // ── new behaviour: job-ID subdirectory — find most recent .md ─────
        let children: string[];
        try {
          children = (await readdir(abs))
            .filter((f) => f.endsWith(".md") && !f.startsWith("."))
            .sort()
            .reverse();
        } catch {
          continue;
        }
        if (children.length === 0) continue;

        const childPath = join(abs, children[0]);
        const cs = await stat(childPath);
        const text = await readFile(childPath, "utf8");
        const output = text.length > MAX_OUTPUT ? text.slice(-MAX_OUTPUT) : text;
        const status: CronLog["status"] = /error|fail|traceback|exception/i.test(output)
          ? "error"
          : "ok";
        logs.push({ name, lastRun: cs.mtime.toISOString(), status, output: output.trim() });
      }
      // anything else (symlink, etc.) — skip silently

    } catch {
      // unreadable — skip
    }
  }
  logs.sort((a, b) => (b.lastRun ?? "").localeCompare(a.lastRun ?? ""));
  return logs.length > 0 ? logs : SAMPLE_CRON;
}\
"""
NEW_FN = """\
/** Fetch cron job logs from the notes server API. Falls back to samples on error. */
async function readCronLogs(): Promise<CronLog[]> {
  try {
    const res = await fetch(`${NOTES_URL}/api/cron-logs?limit=50`, {
      headers: { "x-notes-token": NOTES_TOKEN },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return SAMPLE_CRON;

    const data = await res.json() as {
      ok: boolean;
      jobs?: Array<{
        job_id: string;
        name: string;
        lastRun: string;
        status: "ok" | "error" | "unknown";
        outputFile: string;
      }>;
    };
    if (!data.ok || !Array.isArray(data.jobs) || data.jobs.length === 0) {
      return SAMPLE_CRON;
    }

    return data.jobs.map((j) => ({
      name:    j.name || j.job_id,
      lastRun: j.lastRun ?? null,
      status:  j.status ?? "unknown",
      output:  "",  // populated on demand via ?file= — not fetched in list view
    }));
  } catch {
    return SAMPLE_CRON;
  }
}\
"""

# Change 3 — imports line (remove readdir/readFile/stat/join/homedir, keep os)
OLD_IMPORTS = """\
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import * as os from "node:os";\
"""
NEW_IMPORTS = """\
import * as os from "node:os";\
"""

# ── Safety helpers ─────────────────────────────────────────────────────────────

def abort(msg: str):
    print(f"\nABORT: {msg}", file=sys.stderr)
    sys.exit(1)

def assert_once(text: str, anchor: str, label: str):
    count = text.count(anchor)
    if count == 0:
        abort(f"{label} — anchor not found.\nLooked for:\n{anchor!r}")
    if count > 1:
        abort(f"{label} — anchor found {count} times (expected exactly 1).\nLooked for:\n{anchor!r}")

# ── Read ───────────────────────────────────────────────────────────────────────

if not TARGET.exists():
    abort(f"Target file not found: {TARGET}")

original = TARGET.read_text()

# ── Validate ALL anchors before touching anything ──────────────────────────────

assert_once(original, OLD_IMPORTS, "imports block")
assert_once(original, OLD_CONSTS,  "constants block")
assert_once(original, OLD_FN,      "readCronLogs() function")

# ── Apply all three replacements ───────────────────────────────────────────────

patched = original
patched = patched.replace(OLD_IMPORTS, NEW_IMPORTS, 1)
patched = patched.replace(OLD_CONSTS,  NEW_CONSTS,  1)
patched = patched.replace(OLD_FN,      NEW_FN,      1)

# ── Post-patch sanity ──────────────────────────────────────────────────────────

checks = [
    ("NOTES_URL"              , "NOTES_URL constant missing"),
    ("NOTES_TOKEN"            , "NOTES_TOKEN constant missing"),
    ("api/cron-logs"          , "fetch URL missing"),
    ("AbortSignal.timeout"    , "timeout missing"),
    ("import * as os"         , "os import missing"),
]
for needle, msg in checks:
    if needle not in patched:
        abort(f"Post-patch sanity failed — {msg}")

gone = ["readdir", "readFile", "stat } from", "join } from", "homedir", "CRON_DIR", "MAX_OUTPUT"]
for needle in gone:
    if needle in patched:
        abort(f"Post-patch sanity failed — '{needle}' still present (should be removed)")

# ── Diff ───────────────────────────────────────────────────────────────────────

diff = list(difflib.unified_diff(
    original.splitlines(keepends=True),
    patched.splitlines(keepends=True),
    fromfile="route.ts (original)",
    tofile="route.ts (patched)",
))

print("=" * 70)
print("PATCH PREVIEW — nothing written yet")
print("=" * 70)
print("".join(diff))
print("=" * 70)
print(f"Target : {TARGET}")
print(f"Backup : {BAK}")
print("=" * 70)

# ── Write ──────────────────────────────────────────────────────────────────────

BAK.write_text(original)
print(f"\nBackup written : {BAK}")

TARGET.write_text(patched)
print(f"Patch applied  : {TARGET}")
print("\nPATCHED OK")

print("""
Next steps (run these yourself):

  1. Verify changes:
     grep -n 'NOTES_URL\\|NOTES_TOKEN\\|cron-logs\\|readdir' \\
       ~/claude-mission-control/src/app/api/logs/route.ts

  2. Rebuild the Mac app:
     cd ~/claude-mission-control && npm run build

  3. Restart the LaunchAgent:
     launchctl kickstart -k gui/$(id -u)/com.wynneops.mission-control

  4. Hard-refresh the panel (Cmd+Shift+R) and open the Logs tab.
""")
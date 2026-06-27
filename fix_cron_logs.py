#!/usr/bin/env python3
"""
fix_cron_logs.py
Patches readCronLogs() in:
  ~/claude-mission-control/src/app/api/logs/route.ts

Change: replace the flat-file-only loop body with a two-branch handler
that also recurses one level into job-ID subdirectories to find the most
recent .md file inside each one.

Safety: aborts if the anchor is not found exactly once. Nothing is written
unless the check passes. Prints a unified diff, then writes backup + patch.
"""

from pathlib import Path
import sys, difflib

TARGET = Path.home() / "claude-mission-control/src/app/api/logs/route.ts"
BAK    = Path.home() / "claude-mission-control/src/app/api/logs/route.ts.bak.fix_cron_logs"

# ── Anchor — the exact block being replaced (lines 53-65 of original) ─────────

OLD = """\
    try {
      const s = await stat(abs);
      if (!s.isFile()) continue;
      const text = await readFile(abs, "utf8");
      const output = text.length > MAX_OUTPUT ? text.slice(-MAX_OUTPUT) : text;
      const status: CronLog["status"] = /error|fail|traceback|exception/i.test(output)
        ? "error"
        : "ok";
      logs.push({ name, lastRun: s.mtime.toISOString(), status, output: output.trim() });
    } catch {
      // unreadable — skip
    }\
"""

NEW = """\
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
    }\
"""

# ── Safety helpers ─────────────────────────────────────────────────────────────

def abort(msg: str):
    print(f"\nABORT: {msg}", file=sys.stderr)
    sys.exit(1)

# ── Read ───────────────────────────────────────────────────────────────────────

if not TARGET.exists():
    abort(f"Target file not found: {TARGET}")

original = TARGET.read_text()

# ── Anchor check ───────────────────────────────────────────────────────────────

count = original.count(OLD)
if count == 0:
    abort(
        "Anchor not found in file.\n"
        "The function body may have already been patched, or whitespace differs.\n"
        f"Looked for:\n{OLD!r}"
    )
if count > 1:
    abort(f"Anchor found {count} times (expected exactly 1) — ambiguous, aborting.")

# ── Apply ──────────────────────────────────────────────────────────────────────

patched = original.replace(OLD, NEW, 1)

# ── Post-patch sanity ──────────────────────────────────────────────────────────

if "s.isDirectory()" not in patched:
    abort("Post-patch sanity failed — isDirectory() branch not found in result.")
if OLD in patched:
    abort("Post-patch sanity failed — old anchor still present after replace.")

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

  1. Verify the change:
     grep -n 'isDirectory\\|isFile\\|children' \\
       ~/claude-mission-control/src/app/api/logs/route.ts

  2. Rebuild the Mac app:
     cd ~/claude-mission-control && npm run build

  3. Restart the LaunchAgent:
     launchctl kickstart -k gui/$(id -u)/com.wynneops.mission-control

  4. Hard-refresh the panel (Cmd+Shift+R) and open the Logs tab.
""")
#!/usr/bin/env python3
"""
fix_obsidian_post.py
One change to:
  ~/claude-mission-control/src/app/api/obsidian/route.ts

Insert path-construction line after `const body = await req.json();`
in the POST handler, so section+file are assembled into section/file.md
before forwarding to the notes server.

Before: body.file = "2026-06-23"         → notes server writes to vault root
After:  body.file = "Logs/2026-06-23.md" → notes server writes to correct path

Safety: aborts if anchor not found exactly once. Nothing written until
check passes. Prints unified diff, then writes backup + patch.
"""

from pathlib import Path
import sys, difflib

TARGET = Path.home() / "claude-mission-control/src/app/api/obsidian/route.ts"
BAK    = Path.home() / "claude-mission-control/src/app/api/obsidian/route.ts.bak.fix_obsidian_post"

OLD = '    const body = await req.json();'
NEW = ('    const body = await req.json();\n'
       '    if (body.section && body.file) '
       'body.file = `${body.section}/${body.file}.md`;')

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
        f"Looked for: {OLD!r}"
    )
if count > 1:
    abort(f"Anchor found {count} times (expected exactly 1) — ambiguous, aborting.")

# ── Apply ──────────────────────────────────────────────────────────────────────

patched = original.replace(OLD, NEW, 1)

# ── Post-patch sanity ──────────────────────────────────────────────────────────

if 'body.section && body.file' not in patched:
    abort("Post-patch sanity failed — inserted line not found in result.")
if OLD not in patched:
    abort("Post-patch sanity failed — original anchor line missing (should still be present).")
if patched.count('const body = await req.json();') != 1:
    abort("Post-patch sanity failed — anchor count wrong after patch.")

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
     grep -n 'body.section\\|body.file' \\
       ~/claude-mission-control/src/app/api/obsidian/route.ts

  2. Rebuild the Mac app:
     cd ~/claude-mission-control && npm run build

  3. Restart the LaunchAgent:
     launchctl kickstart -k gui/$(id -u)/com.wynneops.mission-control

  4. Hard-refresh the panel (Cmd+Shift+R) — open Logs tab — Save failed should be gone.
""")
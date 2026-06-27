#!/usr/bin/env python3
"""
fix_logs_panel_paused.py
Add "paused" status support to LogsPanel.tsx.

Changes:
  1. Line 13 — add "paused" to CronLog status union
  2. STATUS_ICON map — add paused entry (CircleDashed, yellow) after unknown line

No import changes needed — CircleDashed is already imported.

Safety: backs up file first, aborts if any anchor is not found exactly once.
Cats the patched lines back for verification before exit.
"""

import shutil
import sys
from pathlib import Path
from datetime import datetime

TARGET = Path("/Users/lucyanne/claude-mission-control/src/components/LogsPanel.tsx")
BACKUP = TARGET.with_suffix(f".tsx.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")

# ── Anchors ──────────────────────────────────────────────────────────────────

ANCHOR_1_OLD = '  status: "ok" | "error" | "unknown";'
ANCHOR_1_NEW = '  status: "ok" | "error" | "unknown" | "paused";'

ANCHOR_2_OLD = '  unknown: <CircleDashed size={13} className="text-[var(--color-ink-faint)]" />,'
ANCHOR_2_NEW = (
    '  unknown: <CircleDashed size={13} className="text-[var(--color-ink-faint)]" />,\n'
    '  paused:  <CircleDashed size={13} className="text-yellow-400" />,'
)

# ── Safety check ─────────────────────────────────────────────────────────────

def check_exactly_once(text: str, anchor: str, label: str) -> None:
    count = text.count(anchor)
    if count == 0:
        print(f"ABORT — anchor not found: {label}")
        print(f"   Looking for: {repr(anchor)}")
        sys.exit(1)
    if count > 1:
        print(f"ABORT — anchor found {count} times (ambiguous): {label}")
        sys.exit(1)
    print(f"OK anchor found exactly once: {label}")

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not TARGET.exists():
        print(f"ABORT — target not found: {TARGET}")
        sys.exit(1)

    text = TARGET.read_text(encoding="utf-8")

    # Validate anchors before touching anything
    check_exactly_once(text, ANCHOR_1_OLD, "CronLog status union")
    check_exactly_once(text, ANCHOR_2_OLD, "STATUS_ICON unknown line")

    # Backup
    shutil.copy2(TARGET, BACKUP)
    print(f"backup -> {BACKUP}")

    # Apply change 1
    text = text.replace(ANCHOR_1_OLD, ANCHOR_1_NEW, 1)
    print("change 1 applied — CronLog status union")

    # Apply change 2
    text = text.replace(ANCHOR_2_OLD, ANCHOR_2_NEW, 1)
    print("change 2 applied — STATUS_ICON paused entry")

    # Write
    TARGET.write_text(text, encoding="utf-8")
    print(f"written -> {TARGET}")

    # Cat back for verification
    lines = text.splitlines()

    print("\n-- verification: CronLog type --")
    for i, line in enumerate(lines):
        if '"ok"' in line and '"paused"' in line:
            start = max(0, i - 1)
            end = min(len(lines), i + 2)
            for j in range(start, end):
                marker = ">>>" if j == i else "   "
                print(f"{marker} {j+1:4d} | {lines[j]}")
            break

    print("\n-- verification: STATUS_ICON paused --")
    for i, line in enumerate(lines):
        if "paused" in line and "CircleDashed" in line:
            start = max(0, i - 2)
            end = min(len(lines), i + 2)
            for j in range(start, end):
                marker = ">>>" if j == i else "   "
                print(f"{marker} {j+1:4d} | {lines[j]}")
            break

    print("\nAll done.")

if __name__ == "__main__":
    main()

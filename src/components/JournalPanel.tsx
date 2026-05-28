"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Save } from "lucide-react";
import { MicButton } from "./MicButton";
import { saveJournal, type VaultSaveResult } from "@/lib/vault-client";
import { localDateStamp } from "@/lib/date";

type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "error"; detail: string };

const KEY_PREFIX = "agentic-os:journal:";

function prettyDate(stamp: string): string {
  const [y, m, d] = stamp.split("-").map(Number);
  if (!y || !m || !d) return stamp;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function JournalPanel() {
  const [today] = useState(() => localDateStamp());
  const [body, setBody] = useState("");
  const [save, setSave] = useState<SaveStatus>({ state: "idle" });
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load today's draft from localStorage on mount (no vault write).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY_PREFIX + today);
      if (stored !== null) setBody(stored);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [today]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function persistToVault(text: string) {
    setSave({ state: "saving" });
    void saveJournal(text).then((r: VaultSaveResult) =>
      setSave(r.ok ? { state: "saved" } : { state: "error", detail: r.error }),
    );
  }

  function update(next: string) {
    setBody(next);
    try {
      localStorage.setItem(KEY_PREFIX + today, next);
    } catch {
      /* ignore quota errors */
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Autosave once typing pauses, but never auto-write an empty entry.
    if (next.trim().length > 0) {
      setSave({ state: "saving" });
      saveTimer.current = setTimeout(() => persistToVault(next), 1000);
    } else {
      setSave({ state: "idle" });
    }
  }

  function saveNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    persistToVault(body);
  }

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="panel mx-auto flex h-full max-w-2xl flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-violet)]/25 to-[var(--color-magenta)]/25 text-[var(--color-violet)]">
            <NotebookPen size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Journal</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">{prettyDate(today)}</p>
          </div>
        </div>
        <SaveBadge save={save} hydrated={hydrated} />
      </header>

      {/* Entry */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
        <div className="relative flex min-h-0 flex-1">
          <textarea
            value={body}
            onChange={(e) => update(e.target.value)}
            placeholder="What happened today? Reflections, wins, blockers…"
            className="h-full w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm leading-relaxed text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-violet)]/50 focus:bg-black/40"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
            {words} {words === 1 ? "word" : "words"} · saves to one file per day
          </span>
          <div className="flex items-center gap-2">
            <MicButton value={body} onValueChange={update} />
            <button
              type="button"
              onClick={saveNow}
              disabled={save.state === "saving"}
              className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-[var(--color-violet)] to-[var(--color-magenta)] px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={15} />
              Save to vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveBadge({ save, hydrated }: { save: SaveStatus; hydrated: boolean }) {
  if (!hydrated) return null;
  const map: Record<SaveStatus["state"], { label: string; color: string }> = {
    idle: { label: "Not saved yet", color: "var(--color-ink-faint)" },
    saving: { label: "Saving…", color: "var(--color-cyan)" },
    saved: { label: "Saved to vault", color: "var(--color-lime)" },
    error: { label: "Save failed", color: "var(--color-danger)" },
  };
  const { label, color } = map[save.state];
  return (
    <span
      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
      style={{ color }}
      title={save.state === "error" ? save.detail : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}

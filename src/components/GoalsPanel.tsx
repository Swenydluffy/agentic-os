"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, Trash2, Check, Pencil } from "lucide-react";
import { MicButton } from "./MicButton";
import { saveGoals, type VaultSaveResult } from "@/lib/vault-client";
import { localDateStamp } from "@/lib/date";
import { cn } from "@/lib/utils";

type Goal = { id: string; text: string; done: boolean };

type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "error"; detail: string };

const STORAGE_KEY = "agentic-os:goals";

function isGoal(v: unknown): v is Goal {
  if (typeof v !== "object" || v === null) return false;
  const g = v as Record<string, unknown>;
  return typeof g.id === "string" && typeof g.text === "string" && typeof g.done === "boolean";
}

export function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [save, setSave] = useState<SaveStatus>({ state: "idle" });
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate the canonical list from localStorage on mount (no vault write).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setGoals(parsed.filter(isGoal));
      }
    } catch {
      /* corrupt storage — start fresh */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  /** Apply a mutation: update state, persist locally, debounce a vault sync. */
  function mutate(next: Goal[]) {
    setGoals(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
    setSave({ state: "saving" });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveGoals(next.map(({ text, done }) => ({ text, done }))).then(
        (r: VaultSaveResult) =>
          setSave(r.ok ? { state: "saved" } : { state: "error", detail: r.error }),
      );
    }, 500);
  }

  function addGoal() {
    const text = draft.trim();
    if (!text) return;
    mutate([...goals, { id: crypto.randomUUID(), text, done: false }]);
    setDraft("");
  }

  function toggle(id: string) {
    mutate(goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));
  }

  function remove(id: string) {
    mutate(goals.filter((g) => g.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function beginEdit(g: Goal) {
    setEditingId(g.id);
    setEditText(g.text);
  }

  function commitEdit() {
    if (editingId === null) return;
    const text = editText.trim();
    mutate(
      text
        ? goals.map((g) => (g.id === editingId ? { ...g, text } : g))
        : goals.filter((g) => g.id !== editingId),
    );
    setEditingId(null);
    setEditText("");
  }

  const doneCount = goals.filter((g) => g.done).length;

  return (
    <div className="panel mx-auto flex h-full max-w-2xl flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-lime)]/25 to-[var(--color-cyan)]/25 text-[var(--color-lime)]">
            <Target size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Goals</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">
              {goals.length === 0
                ? "No goals yet — add your first below"
                : `${doneCount} of ${goals.length} done`}
            </p>
          </div>
        </div>
        <SaveBadge save={save} hydrated={hydrated} />
      </header>

      {/* Add goal */}
      <div className="flex items-end gap-2 border-b border-white/5 px-5 py-3">
        <MicButton value={draft} onValueChange={setDraft} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addGoal();
            }
          }}
          placeholder="Add a goal…"
          className="h-11 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-lime)]/50 focus:bg-black/40"
        />
        <button
          type="button"
          onClick={addGoal}
          disabled={!draft.trim()}
          aria-label="Add goal"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-lime)] to-[var(--color-cyan)] text-[#04060d] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {goals.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[var(--color-ink-faint)]">
            <Target size={28} className="opacity-40" />
            <p className="text-sm">Your goals will appear here and sync to your vault.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {goals.map((g) => {
              const editing = editingId === g.id;
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/[0.03]"
                >
                  <button
                    type="button"
                    onClick={() => toggle(g.id)}
                    role="checkbox"
                    aria-checked={g.done}
                    aria-label={g.done ? "Mark as not done" : "Mark as done"}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                      g.done
                        ? "border-[var(--color-lime)] bg-[var(--color-lime)] text-[#04060d]"
                        : "border-white/20 text-transparent hover:border-[var(--color-lime)]/60",
                    )}
                  >
                    <Check size={13} strokeWidth={3} />
                  </button>

                  {editing ? (
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitEdit();
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                          setEditText("");
                        }
                      }}
                      className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white outline-none focus:border-[var(--color-cyan)]/60"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => beginEdit(g)}
                      className={cn(
                        "flex-1 truncate text-left text-sm transition",
                        g.done ? "text-[var(--color-ink-faint)] line-through" : "text-[var(--color-ink)]",
                      )}
                      title="Click to edit"
                    >
                      {g.text}
                    </button>
                  )}

                  {!editing && (
                    <button
                      type="button"
                      onClick={() => beginEdit(g)}
                      aria-label="Edit goal"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-ink-faint)] opacity-0 transition hover:bg-white/5 hover:text-white group-hover:opacity-100"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(g.id)}
                    aria-label="Delete goal"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-ink-faint)] opacity-0 transition hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function SaveBadge({ save, hydrated }: { save: SaveStatus; hydrated: boolean }) {
  if (!hydrated) return null;
  const map: Record<SaveStatus["state"], { label: string; color: string }> = {
    idle: { label: "Synced to vault", color: "var(--color-ink-faint)" },
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

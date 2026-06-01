"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KanbanSquare, Plus, Trash2, X, GripVertical } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { saveVaultMarkdown, type VaultSaveResult } from "@/lib/vault-client";
import { cn } from "@/lib/utils";

const ACCENT = "#60a5fa";
const STORAGE_KEY = "agentic-os:kanban";
/** Single board, so one file. Saved to Agentic OS/Kanban/board.md in the vault. */
const BOARD_NAME = "board";

type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "error"; detail: string };

type ColumnId = "backlog" | "in-progress" | "review" | "done";
type Priority = "low" | "medium" | "high";

interface Card {
  id: string;
  title: string;
  description: string;
  agent: string;
  priority: Priority;
  column: ColumnId;
}

const COLUMNS: { id: ColumnId; label: string; accent: string }[] = [
  { id: "backlog", label: "Backlog", accent: "var(--color-ink-faint)" },
  { id: "in-progress", label: "In Progress", accent: ACCENT },
  { id: "review", label: "Review", accent: "var(--color-amber)" },
  { id: "done", label: "Done", accent: "var(--color-lime)" },
];

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low: { label: "Low", color: "var(--color-cyan)" },
  medium: { label: "Medium", color: "var(--color-amber)" },
  high: { label: "High", color: "var(--color-danger)" },
};

const AGENT_NAMES = AGENTS.map((a) => a.name);

function isPriority(v: unknown): v is Priority {
  return v === "low" || v === "medium" || v === "high";
}
function isColumn(v: unknown): v is ColumnId {
  return v === "backlog" || v === "in-progress" || v === "review" || v === "done";
}
function isCard(v: unknown): v is Card {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    typeof c.description === "string" &&
    typeof c.agent === "string" &&
    isPriority(c.priority) &&
    isColumn(c.column)
  );
}

/** Render the board as Obsidian-friendly markdown (one checkbox list per column). */
function boardToMarkdown(cards: Card[]): string {
  const lines: string[] = [
    "---",
    `updated: ${new Date().toISOString()}`,
    "tags:",
    "  - agentic-os",
    "  - kanban",
    "type: kanban",
    "---",
    "",
    "# Kanban Board",
    "",
    `_${cards.length} ${cards.length === 1 ? "card" : "cards"}_`,
    "",
  ];
  for (const col of COLUMNS) {
    const colCards = cards.filter((c) => c.column === col.id);
    lines.push(`## ${col.label} (${colCards.length})`, "");
    if (colCards.length === 0) {
      lines.push("_None_", "");
      continue;
    }
    for (const c of colCards) {
      const checked = col.id === "done" ? "x" : " ";
      const meta = [PRIORITY_META[c.priority].label];
      if (c.agent) meta.push(`@${c.agent}`);
      lines.push(`- [${checked}] **${c.title}** · ${meta.join(" · ")}`);
      if (c.description.trim()) lines.push(`  ${c.description.trim().replace(/\s*\n\s*/g, " ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function KanbanPanel() {
  const [cards, setCards] = useState<Card[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [composerColumn, setComposerColumn] = useState<ColumnId | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ColumnId | null>(null);
  const [vaultSave, setVaultSave] = useState<SaveStatus>({ state: "idle" });
  const skipPersist = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from localStorage once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setCards(parsed.filter(isCard));
      }
    } catch {
      /* corrupt storage — start fresh */
    }
    setHydrated(true);
  }, []);

  // Persist on change (but never the empty pre-hydration state).
  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch {
      /* ignore quota errors */
    }
  }, [cards]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  /** Apply a board mutation: update state, then debounce a vault sync. */
  function commit(next: Card[]) {
    setCards(next);
    setVaultSave({ state: "saving" });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveVaultMarkdown({
        section: "Kanban",
        file: BOARD_NAME,
        content: boardToMarkdown(next),
      }).then((r: VaultSaveResult) =>
        setVaultSave(r.ok ? { state: "saved" } : { state: "error", detail: r.error }),
      );
    }, 600);
  }

  function addCard(card: Omit<Card, "id">) {
    commit([...cards, { ...card, id: crypto.randomUUID() }]);
  }
  function removeCard(id: string) {
    commit(cards.filter((x) => x.id !== id));
  }
  function moveCard(id: string, column: ColumnId) {
    const card = cards.find((x) => x.id === id);
    if (!card || card.column === column) return; // no-op drops don't dirty the vault
    commit(cards.map((x) => (x.id === id ? { ...x, column } : x)));
  }

  function onDrop(column: ColumnId) {
    if (dragId) moveCard(dragId, column);
    setDragId(null);
    setDragOver(null);
  }

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <KanbanSquare size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Kanban Board</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">
              {hydrated ? `${cards.length} cards · drag between columns` : "Loading board…"}
            </p>
          </div>
        </div>
        <SaveBadge save={vaultSave} hydrated={hydrated} />
      </header>

      {/* Columns */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-x-auto p-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.column === col.id);
          const isOver = dragOver === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOver !== col.id) setDragOver(col.id);
              }}
              onDragLeave={(e) => {
                // Only clear when leaving the column wrapper, not a child.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOver((d) => (d === col.id ? null : d));
                }
              }}
              onDrop={() => onDrop(col.id)}
              className={cn(
                "flex min-h-0 flex-col rounded-2xl border bg-white/[0.015] transition",
                isOver ? "border-white/25 bg-white/[0.04]" : "border-white/10",
              )}
            >
              {/* Column header */}
              <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: col.accent, boxShadow: `0 0 8px ${col.accent}` }}
                  />
                  <span className="text-sm font-medium text-white">{col.label}</span>
                  <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[var(--color-ink-dim)]">
                    {colCards.length}
                  </span>
                </div>
                <button
                  onClick={() => setComposerColumn((c) => (c === col.id ? null : col.id))}
                  aria-label={`Add card to ${col.label}`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-ink-dim)] transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Cards */}
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                <AnimatePresence initial={false}>
                  {composerColumn === col.id && (
                    <Composer
                      key="composer"
                      column={col.id}
                      onCancel={() => setComposerColumn(null)}
                      onAdd={(card) => {
                        addCard(card);
                        setComposerColumn(null);
                      }}
                    />
                  )}
                </AnimatePresence>

                {colCards.length === 0 && composerColumn !== col.id && (
                  <div className="flex flex-1 items-center justify-center py-8 text-center text-xs text-[var(--color-ink-faint)]">
                    Drop cards here
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {colCards.map((card) => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      dragging={dragId === card.id}
                      onDragStart={() => setDragId(card.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOver(null);
                      }}
                      onDelete={() => removeCard(card.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------- card ----------------------------------- */

function KanbanCard({
  card,
  dragging,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  card: Card;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDelete: () => void;
}) {
  const prio = PRIORITY_META[card.priority];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: dragging ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      draggable
      onDragStart={(e) => {
        // framer-motion forwards the native event; mark the payload.
        (e as unknown as DragEvent).dataTransfer?.setData("text/plain", card.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="group cursor-grab rounded-xl border border-white/10 bg-white/[0.03] p-3 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-0.5 shrink-0 text-[var(--color-ink-faint)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-snug text-white">{card.title}</h4>
            <button
              onClick={onDelete}
              aria-label="Delete card"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--color-ink-faint)] opacity-0 transition hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)] group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
          {card.description && (
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-dim)]">{card.description}</p>
          )}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span
              className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
              style={{ background: `${prio.color}1f`, color: prio.color }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: prio.color }} />
              {prio.label}
            </span>
            {card.agent && (
              <span className="truncate rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[var(--color-ink-dim)]">
                {card.agent}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------------- save badge ------------------------------- */

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

/* -------------------------------- composer --------------------------------- */

function Composer({
  column,
  onAdd,
  onCancel,
}: {
  column: ColumnId;
  onAdd: (card: Omit<Card, "id">) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agent, setAgent] = useState(AGENT_NAMES[0] ?? "");
  const [priority, setPriority] = useState<Priority>("medium");

  function submit() {
    const t = title.trim();
    if (!t) return;
    onAdd({ title: t, description: description.trim(), agent, priority, column });
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-black/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
            New card
          </span>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-ink-faint)] transition hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
          placeholder="Title"
          className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-white/25"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Description (optional)"
          className="resize-none rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-white/25"
        />
        <div className="flex gap-2">
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            aria-label="Assigned agent"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none transition focus:border-white/25"
          >
            {AGENT_NAMES.map((name) => (
              <option key={name} value={name} className="bg-[#0a0e1a]">
                {name}
              </option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => {
              const v = e.target.value;
              if (isPriority(v)) setPriority(v);
            }}
            aria-label="Priority"
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white outline-none transition focus:border-white/25"
          >
            {(["high", "medium", "low"] as const).map((p) => (
              <option key={p} value={p} className="bg-[#0a0e1a]">
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-[#04060d] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          <Plus size={14} /> Add card
        </button>
      </div>
    </motion.div>
  );
}

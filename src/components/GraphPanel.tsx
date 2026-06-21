"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, RefreshCw, X, FileText, Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/Markdown";

const ACCENT = "#a78bfa";

const CATEGORY_COLORS: Record<string, string> = {
  People:    "#60a5fa",
  Projects:  "#34d399",
  Areas:     "#34d399",
  Ideas:     "#f472b6",
  Tech:      "#fb923c",
  Insights:  "#facc15",
  Finance:   "#a3e635",
  Places:    "#38bdf8",
  Knowledge: "#a78bfa",
  Daily:     "#94a3b8",
  Intake:    "#64748b",
  Templates: "#475569",
  default:   "#94a3b8",
};

interface NoteEntry {
  path: string;
  name: string;
  size: number;
  mtime: string;
  dir: string;
}


type NoteState =
  | { status: "idle" }
  | { status: "loading"; path: string; title: string; color: string }
  | { status: "ready";   path: string; title: string; color: string; content: string }
  | { status: "error";   path: string; title: string; color: string; message: string };

function getCategory(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : "Root";
}

function buildGraph(_notes: NoteEntry[], _w: number, _h: number) { return { nodes: [] as {id:string}[], edges: [] as {source:string,target:string}[] }; }


function NoteReader({ state, onClose }: { state: NoteState; onClose: () => void }) {
  if (state.status === "idle") return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col h-full border-l border-white/5"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0" style={{ background: `${state.color}08` }}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${state.color}20`, color: state.color }}>
          <FileText size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white leading-tight">{state.title}</p>
          <p className="truncate font-mono text-[10px] text-[var(--color-ink-faint)]">{state.path}</p>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)] hover:text-white transition">
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
        {state.status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-12 text-[var(--color-ink-faint)]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10" style={{ borderTopColor: state.color }} />
            <span className="text-xs font-mono">Loading…</span>
          </div>
        )}
        {state.status === "error" && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <p className="text-xs font-medium text-white mb-1">Failed to load</p>
            <p className="text-xs text-[var(--color-ink-dim)] font-mono">{state.message}</p>
          </div>
        )}
        {state.status === "ready" && (
          <div className="prose-sm text-[var(--color-ink)]">
            <Markdown source={state.content} />
          </div>
        )}
      </div>

      {/* Footer tag */}
      <div className="px-4 py-2 border-t border-white/5 shrink-0">
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest"
          style={{ borderColor: `${state.color}40`, color: state.color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: state.color }} />
          {getCategory(state.path)}
        </span>
      </div>
    </motion.div>
  );
}

// ── Node list ─────────────────────────────────────────────────────────────────
function NodeList({
  notes, activeCategory, onSelectNote, activeNotePath,
}: {
  notes: NoteEntry[];
  activeCategory: string | null;
  onCategoryChange: (cat: string | null) => void;
  onSelectNote: (note: NoteEntry) => void;
  activeNotePath: string | null;
}) {
  const [search, setSearch] = useState("");

  const categories = Array.from(new Set(notes.map(n => getCategory(n.path)))).sort();

  const filtered = notes.filter(n => {
    const cat = getCategory(n.path);
    if (activeCategory && cat !== activeCategory) return false;
    if (search) {
      const label = n.name.replace(/\.md$/, "").toLowerCase();
      return label.includes(search.toLowerCase());
    }
    return cat !== "Root"; // hide flat root files unless searching
  });

  return (
    <div className="flex flex-col h-full border-l border-white/5">
      {/* Search */}
      <div className="px-3 py-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
          <Search size={12} className="text-[var(--color-ink-faint)] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="flex-1 bg-transparent text-xs text-white placeholder:text-[var(--color-ink-faint)] outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-[var(--color-ink-faint)] hover:text-white transition">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-xs text-center text-[var(--color-ink-faint)]">No notes found</p>
        ) : (
          filtered.map(note => {
            const cat = getCategory(note.path);
            const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default;
            const label = note.name.replace(/\.md$/, "").replace(/-/g, " ");
            const isActive = note.path === activeNotePath;
            return (
              <button
                key={note.path}
                onClick={() => onSelectNote(note)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left transition group",
                  isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                )}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className={cn("flex-1 truncate text-xs", isActive ? "text-white" : "text-[var(--color-ink-dim)] group-hover:text-white transition")}>
                  {label}
                </span>
                <ChevronRight size={10} className={cn("shrink-0 transition", isActive ? "text-white opacity-100" : "opacity-0 group-hover:opacity-40")} />
              </button>
            );
          })
        )}
      </div>

      <div className="px-3 py-2 border-t border-white/5 shrink-0">
        <p className="text-[10px] text-[var(--color-ink-faint)]">{filtered.length} nodes{activeCategory ? ` in ${activeCategory}` : ""}</p>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export function GraphPanel() {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [noteState, setNoteState] = useState<NoteState>({ status: "idle" });

  const fetchNotes = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/obsidian", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setNotes(data.notes as NoteEntry[]);
      } else {
        setError(data.error ?? "Failed to load vault");
      }
    } catch {
      setError("Couldn't reach /api/obsidian");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchNotes(); }, [fetchNotes]);

  const openNote = useCallback(async (note: NoteEntry) => {
    const cat = getCategory(note.path);
    const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default;
    const title = note.name.replace(/\.md$/, "").replace(/-/g, " ");
    setNoteState({ status: "loading", path: note.path, title, color });
    try {
      const res = await fetch(`/api/obsidian?file=${encodeURIComponent(note.path)}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setNoteState({ status: "ready", path: note.path, title, color, content: data.content as string });
      } else {
        setNoteState({ status: "error", path: note.path, title, color, message: data.error ?? "Unknown error" });
      }
    } catch (e) {
      setNoteState({ status: "error", path: note.path, title, color, message: e instanceof Error ? e.message : "Network error" });
    }
  }, []);

  const structuredNotes = notes.filter(n => n.path.includes("/"));
  const stats = { total: structuredNotes.length, categories: new Set(structuredNotes.map(n => getCategory(n.path))).size };
  const readerOpen = noteState.status !== "idle";

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4 shrink-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${ACCENT}22`, color: ACCENT }}>
          <GitBranch size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-wide text-white">Brain Graph</h2>
          <p className="text-xs text-[var(--color-ink-dim)]">
            {loading ? "Loading vault…" : `${stats.total} nodes · ${stats.categories} categories`}
          </p>
        </div>
        <button onClick={() => void fetchNotes()} disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[var(--color-ink-dim)] transition hover:text-white disabled:opacity-50">
          <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          Refresh
        </button>
      </header>

      {/* Body: graph | list | reader */}
      {error ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[var(--color-ink-faint)]">{error}</p>
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">Building graph…</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Middle: node list */}
          <div className={cn("flex flex-col overflow-hidden", readerOpen ? "w-[260px] shrink-0" : "flex-1")}>
            <NodeList
              notes={structuredNotes}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onSelectNote={openNote}
              activeNotePath={noteState.status !== "idle" ? noteState.path : null}
            />
          </div>

          {/* Right: note reader */}
          <AnimatePresence>
            {readerOpen && (
              <div className="flex-1 overflow-hidden">
                <NoteReader state={noteState} onClose={() => setNoteState({ status: "idle" })} />
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

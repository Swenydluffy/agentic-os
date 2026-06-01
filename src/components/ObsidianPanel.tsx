"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { NotebookText, Search, FileText, Folder, Clock, RefreshCw } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

const ACCENT = "#8b5cf6";

interface NoteMeta {
  path: string;
  name: string;
  dir: string;
  size: number;
  mtime: string;
}

interface NoteContent {
  path: string;
  name: string;
  content: string;
  size: number;
  mtime: string;
  truncated: boolean;
}

interface SearchHit {
  path: string;
  name: string;
  matches: { line: number; text: string }[];
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < day) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ObsidianPanel() {
  const [notes, setNotes] = useState<NoteMeta[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<NoteContent | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setListError(null);
    try {
      const res = await fetch("/api/obsidian", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) setNotes(data.notes as NoteMeta[]);
      else setListError(data.error ?? "Couldn't list the vault.");
    } catch {
      setListError("Couldn't reach /api/obsidian.");
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits(null);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/obsidian?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok && data.ok) setHits(data.hits as SearchHit[]);
      } catch {
        setHits([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const openNote = useCallback(async (path: string) => {
    setSelected(path);
    setNoteLoading(true);
    setNoteError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/obsidian?file=${encodeURIComponent(path)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) setNote(data.note as NoteContent);
      else setNoteError(data.error ?? "Couldn't read the note.");
    } catch {
      setNoteError("Couldn't reach /api/obsidian.");
    } finally {
      setNoteLoading(false);
    }
  }, []);

  // Group notes by top-level folder for the tree view.
  const grouped = useMemo(() => {
    if (!notes) return [];
    const groups = new Map<string, NoteMeta[]>();
    for (const n of notes) {
      const top = n.dir === "" ? "" : n.dir.split("/")[0];
      const arr = groups.get(top) ?? [];
      arr.push(n);
      groups.set(top, arr);
    }
    return [...groups.entries()].sort((a, b) => (a[0] === "" ? -1 : b[0] === "" ? 1 : a[0].localeCompare(b[0])));
  }, [notes]);

  const searching = query.trim().length > 0;

  return (
    <div className="panel flex h-full overflow-hidden">
      {/* Left: notes + search */}
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-white/5">
        <header className="flex items-center gap-3 border-b border-white/5 px-4 py-4">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <NotebookText size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold tracking-wide text-white">Obsidian</h2>
            <p className="truncate text-[11px] text-[var(--color-ink-faint)]">
              {notes ? `${notes.length} notes` : "Loading…"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadList()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)] transition hover:bg-white/[0.08] hover:text-white"
            title="Refresh notes"
          >
            <RefreshCw size={13} />
          </button>
        </header>

        <div className="border-b border-white/5 px-4 py-3">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all notes…"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-white/25"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {listError ? (
            <p className="px-2 py-3 font-mono text-xs text-[var(--color-amber)]">{listError}</p>
          ) : searching ? (
            <SearchResults hits={hits} selected={selected} onOpen={openNote} />
          ) : (
            grouped.map(([folder, items]) => (
              <div key={folder || "(root)"} className="mb-2">
                <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
                  <Folder size={11} />
                  {folder || "Vault root"}
                </div>
                {items.map((n) => (
                  <NoteRow
                    key={n.path}
                    note={n}
                    active={selected === n.path}
                    onClick={() => void openNote(n.path)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Right: note content */}
      <section className="flex min-w-0 flex-1 flex-col">
        {note && !noteLoading ? (
          <>
            <header className="border-b border-white/5 px-6 py-4">
              <h3 className="font-display text-lg font-semibold text-white">{note.name}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--color-ink-faint)]">
                <span className="truncate">{note.path}</span>
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {fmtWhen(note.mtime)}
                </span>
                <span>{fmtSize(note.size)}</span>
                {note.truncated && <span className="text-[var(--color-amber)]">truncated</span>}
              </p>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-5 text-sm">
              <Markdown source={note.content} />
            </div>
          </>
        ) : noteLoading ? (
          <Centered text="Opening note…" />
        ) : noteError ? (
          <Centered text={noteError} tone="amber" />
        ) : (
          <Centered text="Select a note to read it." icon />
        )}
      </section>
    </div>
  );
}

function NoteRow({ note, active, onClick }: { note: NoteMeta; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
        active ? "bg-white/[0.07] text-white" : "text-[var(--color-ink-dim)] hover:bg-white/[0.03] hover:text-white",
      )}
    >
      <FileText size={13} className="shrink-0 text-[var(--color-ink-faint)]" />
      <span className="min-w-0 flex-1 truncate">{note.name}</span>
      <span className="shrink-0 font-mono text-[10px] text-[var(--color-ink-faint)]">{fmtWhen(note.mtime)}</span>
    </button>
  );
}

function SearchResults({
  hits,
  selected,
  onOpen,
}: {
  hits: SearchHit[] | null;
  selected: string | null;
  onOpen: (path: string) => void;
}) {
  if (hits === null) return <p className="px-2 py-3 font-mono text-xs text-[var(--color-ink-faint)]">Searching…</p>;
  if (hits.length === 0) return <p className="px-2 py-3 font-mono text-xs text-[var(--color-ink-faint)]">No matches.</p>;
  return (
    <div className="space-y-1">
      {hits.map((h) => (
        <button
          key={h.path}
          type="button"
          onClick={() => onOpen(h.path)}
          className={cn(
            "block w-full rounded-lg px-2 py-2 text-left transition",
            selected === h.path ? "bg-white/[0.07]" : "hover:bg-white/[0.03]",
          )}
        >
          <div className="flex items-center gap-2 text-sm text-white">
            <FileText size={13} className="shrink-0 text-[var(--color-ink-faint)]" />
            <span className="min-w-0 flex-1 truncate">{h.name}</span>
          </div>
          {h.matches.slice(0, 3).map((m, i) => (
            <p key={i} className="mt-1 truncate pl-5 font-mono text-[11px] text-[var(--color-ink-faint)]">
              <span className="text-[var(--color-ink-dim)]">L{m.line}</span> {m.text}
            </p>
          ))}
        </button>
      ))}
    </div>
  );
}

function Centered({ text, tone, icon }: { text: string; tone?: "amber"; icon?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
    >
      {icon && <NotebookText size={28} className="text-[var(--color-ink-faint)]" />}
      <p
        className={cn(
          "font-mono text-xs",
          tone === "amber" ? "text-[var(--color-amber)]" : "text-[var(--color-ink-faint)]",
        )}
      >
        {text}
      </p>
    </motion.div>
  );
}

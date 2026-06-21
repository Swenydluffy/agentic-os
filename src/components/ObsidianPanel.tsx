"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Search, RefreshCw, FolderOpen, FileText, ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT = "#a78bfa"; // purple for Obsidian

interface NoteEntry {
  path: string;
  name: string;
  size: number;
  mtime: string;
}

interface NotesListResponse {
  ok: boolean;
  root: string;
  notes: NoteEntry[];
  error?: string;
}

interface NoteContentResponse {
  ok: boolean;
  path: string;
  content: string;
  error?: string;
}

// Group notes by folder prefix
function groupNotes(notes: NoteEntry[]): Record<string, NoteEntry[]> {
  const groups: Record<string, NoteEntry[]> = {};
  for (const note of notes) {
    const parts = note.path.split("/");
    const folder = parts.length > 1 ? parts[0] : "__root__";
    if (!groups[folder]) groups[folder] = [];
    groups[folder].push(note);
  }
  return groups;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

// Pinned Knowledge nodes shown first
const PINNED_FOLDERS = ["Knowledge"];

export function ObsidianPanel() {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>("Knowledge");
  const [selectedNote, setSelectedNote] = useState<NoteEntry | null>(null);
  const [noteContent, setNoteContent] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/obsidian", { cache: "no-store" });
      const data = (await res.json()) as NotesListResponse;
      if (data.ok) {
        setNotes(data.notes);
      } else {
        setError(data.error ?? "Failed to load notes");
      }
    } catch {
      setError("Couldn't reach /api/obsidian");
    } finally {
      setLoading(false);
    }
  }, []);

  const openNote = useCallback(async (note: NoteEntry) => {
    setSelectedNote(note);
    setNoteContent(null);
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/obsidian?file=${encodeURIComponent(note.path)}`, { cache: "no-store" });
      const data = (await res.json()) as NoteContentResponse;
      if (data.ok) {
        setNoteContent(data.content);
      } else {
        setNoteContent(`Error: ${data.error}`);
      }
    } catch {
      setNoteContent("Error loading note content");
    } finally {
      setNoteLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  // Filter notes by query
  const filtered = query.trim()
    ? notes.filter(
        (n) =>
          n.name.toLowerCase().includes(query.toLowerCase()) ||
          n.path.toLowerCase().includes(query.toLowerCase())
      )
    : notes;

  const groups = groupNotes(filtered);

  // Sort folders: pinned first, then alphabetically
  const folders = Object.keys(groups).sort((a, b) => {
    const aPin = PINNED_FOLDERS.indexOf(a);
    const bPin = PINNED_FOLDERS.indexOf(b);
    if (aPin !== -1 && bPin === -1) return -1;
    if (bPin !== -1 && aPin === -1) return 1;
    if (a === "__root__") return 1;
    if (b === "__root__") return -1;
    return a.localeCompare(b);
  });

  const folderNotes = selectedFolder ? (groups[selectedFolder] ?? []) : [];

  // Note reader view
  if (selectedNote) {
    return (
      <div className="panel flex h-full flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={() => { setSelectedNote(null); setNoteContent(null); }}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[var(--color-ink-dim)] transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-sm font-semibold tracking-wide text-white">
              {selectedNote.name.replace(/\.md$/, "")}
            </h2>
            <p className="text-[10px] text-[var(--color-ink-faint)]">
              {selectedNote.path} · {fmtSize(selectedNote.size)} · {fmtDate(selectedNote.mtime)}
            </p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {noteLoading ? (
            <p className="font-mono text-xs text-[var(--color-ink-faint)]">Loading…</p>
          ) : noteContent ? (
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--color-ink)]">
              {noteContent}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }

  // Folder drill-down view
  if (selectedFolder) {
    return (
      <div className="panel flex h-full flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <button
            type="button"
            onClick={() => setSelectedFolder(null)}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[var(--color-ink-dim)] transition hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft size={13} />
            All Nodes
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-semibold tracking-wide text-white">
              {selectedFolder === "__root__" ? "Root Files" : selectedFolder}
            </h2>
            <p className="text-[10px] text-[var(--color-ink-faint)]">{folderNotes.length} notes</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            {folderNotes.map((note, i) => (
              <motion.button
                key={note.path}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.2) }}
                onClick={() => void openNote(note)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <FileText size={14} style={{ color: ACCENT }} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {note.name.replace(/\.md$/, "")}
                  </p>
                  <p className="text-[10px] text-[var(--color-ink-faint)]">
                    {fmtSize(note.size)} · {fmtDate(note.mtime)}
                  </p>
                </div>
                <ChevronRight size={13} className="shrink-0 text-[var(--color-ink-faint)]" />
              </motion.button>
            ))}
            {folderNotes.length === 0 && (
              <p className="font-mono text-xs text-[var(--color-ink-faint)]">No notes in this folder.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Root folder browser
  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${ACCENT}22`, color: ACCENT }}
        >
          <BookOpen size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-wide text-white">Obsidian Brain</h2>
          <p className="text-xs text-[var(--color-ink-dim)]">
            {loading ? "Loading…" : `${notes.length} notes across ${folders.length} nodes`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchNotes()}
          disabled={loading}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[var(--color-ink-dim)] transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          Refresh
        </button>
      </header>

      {/* Search */}
      <div className="border-b border-white/5 px-5 py-4">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-white/25"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error ? (
          <div className="rounded-2xl border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/5 p-4">
            <p className="text-sm font-medium text-white">Obsidian unavailable</p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--color-ink-dim)]">{error}</p>
          </div>
        ) : loading ? (
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">Loading vault…</p>
        ) : (
          <div className="space-y-2">
            {folders.map((folder, i) => {
              const folderItems = groups[folder];
              const isPinned = PINNED_FOLDERS.includes(folder);
              const label = folder === "__root__" ? "Root Files" : folder;
              return (
                <motion.button
                  key={folder}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.3) }}
                  onClick={() => setSelectedFolder(folder)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    isPinned
                      ? "border-[#a78bfa]/30 bg-[#a78bfa]/5 hover:border-[#a78bfa]/50 hover:bg-[#a78bfa]/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                  )}
                >
                  <FolderOpen
                    size={16}
                    className="shrink-0"
                    style={{ color: isPinned ? ACCENT : "#94a3b8" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", isPinned ? "text-white" : "text-[var(--color-ink)]")}>
                      {label}
                      {isPinned && (
                        <span className="ml-2 rounded-full border border-[#a78bfa]/40 px-1.5 py-0.5 text-[9px] uppercase tracking-widest" style={{ color: ACCENT }}>
                          pinned
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[var(--color-ink-faint)]">{folderItems.length} notes</p>
                  </div>
                  <ChevronRight size={13} className="shrink-0 text-[var(--color-ink-faint)]" />
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

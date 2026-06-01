"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Search, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT = "#2dd4bf";

type OmiTag = "Preferences" | "Tech" | "Files" | "Chickens" | "General";

const TAG_COLOR: Record<OmiTag, string> = {
  Preferences: "#f472b6",
  Tech: "#60a5fa",
  Files: "#fbbf24",
  Chickens: "#34d399",
  General: "#94a3b8",
};

interface OmiMemory {
  id: number;
  text: string;
  tag: OmiTag;
}

interface OmiResponse {
  ok: boolean;
  generatedAt?: string | null;
  syncedAt?: string;
  total?: number;
  matched?: number;
  tagCounts?: Record<OmiTag, number>;
  memories?: OmiMemory[];
  error?: string;
}

type LoadState =
  | { state: "loading" }
  | { state: "ready"; data: OmiResponse }
  | { state: "error"; message: string };

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OmiPanel() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<OmiTag | null>(null);
  const [load, setLoad] = useState<LoadState>({ state: "loading" });

  const fetchMemories = useCallback(async (q: string, t: OmiTag | null) => {
    setLoad({ state: "loading" });
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (t) params.set("tag", t);
      // Show more when filtering; the default recent view shows 10.
      params.set("limit", q.trim() || t ? "50" : "10");
      const res = await fetch(`/api/omi?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as OmiResponse;
      if (res.ok && data.ok) setLoad({ state: "ready", data });
      else setLoad({ state: "error", message: data.error ?? "Couldn't read OMI memories." });
    } catch {
      setLoad({ state: "error", message: "Couldn't reach /api/omi." });
    }
  }, []);

  // Debounce the query; tag changes apply immediately.
  useEffect(() => {
    const id = setTimeout(() => void fetchMemories(query, tag), 280);
    return () => clearTimeout(id);
  }, [query, tag, fetchMemories]);

  const data = load.state === "ready" ? load.data : undefined;
  const filtering = query.trim().length > 0 || tag !== null;

  const tagChips = useMemo(() => {
    const counts = data?.tagCounts;
    return (["Preferences", "Tech", "Files", "Chickens", "General"] as OmiTag[]).map((t) => ({
      tag: t,
      count: counts?.[t] ?? 0,
    }));
  }, [data?.tagCounts]);

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${ACCENT}22`, color: ACCENT }}
        >
          <Brain size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-wide text-white">OMI</h2>
          <p className="flex items-center gap-1.5 text-xs text-[var(--color-ink-dim)]">
            <Clock size={11} />
            Synced {fmtDate(data?.syncedAt)} · {data?.total ?? "—"} memories from your wearable
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchMemories(query, tag)}
          disabled={load.state === "loading"}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[var(--color-ink-dim)] transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn(load.state === "loading" && "animate-spin")} />
          Refresh
        </button>
      </header>

      {/* Search + tag filter */}
      <div className="space-y-3 border-b border-white/5 px-5 py-4">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all memories…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-white/25"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip label="All" active={tag === null} color={ACCENT} onClick={() => setTag(null)} />
          {tagChips.map(({ tag: t, count }) => (
            <FilterChip
              key={t}
              label={`${t} ${count}`}
              active={tag === t}
              color={TAG_COLOR[t]}
              onClick={() => setTag(tag === t ? null : t)}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {load.state === "error" ? (
          <OmiErrorBox message={load.message} />
        ) : load.state === "loading" && !data ? (
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">Loading memories…</p>
        ) : data && data.memories && data.memories.length > 0 ? (
          <>
            <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
              {filtering
                ? `${data.matched} match${data.matched === 1 ? "" : "es"} · showing ${data.memories.length}`
                : "10 most recent"}
            </p>
            <div className="space-y-2.5">
              {data.memories.map((m, i) => (
                <MemoryCard key={m.id} memory={m} index={i} />
              ))}
            </div>
          </>
        ) : (
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">
            No memories match{tag ? ` "${tag}"` : ""}
            {query.trim() ? ` "${query.trim()}"` : ""}.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-medium transition",
        active ? "text-[#04060d]" : "border-white/10 text-[var(--color-ink-dim)] hover:text-white",
      )}
      style={active ? { background: color, borderColor: color } : undefined}
    >
      {label}
    </button>
  );
}

function MemoryCard({ memory, index }: { memory: OmiMemory; index: number }) {
  const color = TAG_COLOR[memory.tag];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.25), ease: [0.2, 0.7, 0.2, 1] }}
      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 transition hover:border-white/20"
    >
      <span
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-[var(--color-ink)]">{memory.text}</p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]"
            style={{ borderColor: `${color}55`, color }}
          >
            {memory.tag}
          </span>
          <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">#{memory.id}</span>
        </div>
      </div>
    </motion.div>
  );
}

function OmiErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/5 p-4">
      <p className="text-sm font-medium text-white">OMI export unavailable</p>
      <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--color-ink-dim)]">{message}</p>
    </div>
  );
}

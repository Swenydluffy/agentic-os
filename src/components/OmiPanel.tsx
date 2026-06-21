"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, RefreshCw, Clock, Phone, MessageSquare, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCENT = "#2dd4bf";

// ── Source config ─────────────────────────────────────────────────────────────
const SOURCE_META: Record<string, { label: string; color: string; Icon: React.FC<{ size?: number; className?: string }> }> = {
  phone: {
    label: "Phone",
    color: "#34d399",
    Icon: ({ size = 13, className }) => <Phone size={size} className={className} />,
  },
  telegram: {
    label: "Telegram",
    color: "#60a5fa",
    Icon: ({ size = 13, className }) => <MessageSquare size={size} className={className} />,
  },
  mind_insurance: {
    label: "Mind Insurance",
    color: "#a78bfa",
    Icon: ({ size = 13, className }) => <Brain size={size} className={className} />,
  },
  manual: {
    label: "Manual",
    color: "#fbbf24",
    Icon: ({ size = 13, className }) => <Zap size={size} className={className} />,
  },
  mission_control: {
    label: "Mission Control",
    color: "#f472b6",
    Icon: ({ size = 13, className }) => <Activity size={size} className={className} />,
  },
};

function getSource(key: string) {
  return (
    SOURCE_META[key] ?? {
      label: key.replace(/_/g, " "),
      color: "#94a3b8",
      Icon: ({ size = 13, className }: { size?: number; className?: string }) => <Activity size={size} className={className} />,
    }
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface IntakeItem {
  id: string;
  source: string;
  date: string;
  snippet: string;
}

interface SourceStat {
  source: string;
  count: number;
  last: string | null;
}

interface NeuroSyncData {
  ok: boolean;
  total: number;
  totalNotes: number;
  sources: SourceStat[];
  recent: IntakeItem[];
  syncedAt: string | null;
  error?: string;
}

type LoadState =
  | { state: "loading" }
  | { state: "ready"; data: NeuroSyncData }
  | { state: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export function OmiPanel() {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>({ state: "loading" });

  const fetchData = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const res = await fetch("/api/neurosync?limit=15", { cache: "no-store" });
      const data = (await res.json()) as NeuroSyncData;
      if (res.ok && data.ok) {
        setLoad({ state: "ready", data });
      } else {
        setLoad({ state: "error", message: data.error ?? "Couldn't load NeuroSync data." });
      }
    } catch {
      setLoad({ state: "error", message: "Couldn't reach /api/neurosync." });
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const data = load.state === "ready" ? load.data : undefined;

  const filteredRecent = useMemo(() => {
    if (!data?.recent) return [];
    if (!activeSource) return data.recent;
    return data.recent.filter((item) => item.source === activeSource);
  }, [data?.recent, activeSource]);

  // Canonical source order: known sources first, then any unknowns
  const orderedSources = useMemo(() => {
    if (!data?.sources) return [];
    const known = ["phone", "telegram", "mind_insurance", "manual", "mission_control"];
    const sorted = [...data.sources].sort((a, b) => {
      const ia = known.indexOf(a.source);
      const ib = known.indexOf(b.source);
      if (ia === -1 && ib === -1) return b.count - a.count;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return sorted;
  }, [data?.sources]);

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${ACCENT}22`, color: ACCENT }}
        >
          <Brain size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-wide text-white">NeuroSync</h2>
          <p className="flex items-center gap-1.5 text-xs text-[var(--color-ink-dim)]">
            <Clock size={11} />
            Last intake {fmtDate(data?.syncedAt)} · {data?.total ?? "—"} total intakes
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchData()}
          disabled={load.state === "loading"}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[var(--color-ink-dim)] transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn(load.state === "loading" && "animate-spin")} />
          Refresh
        </button>
      </header>

      {/* Source badges */}
      <div className="border-b border-white/5 px-5 py-4">
        <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
          Active Sources
        </p>
        {load.state === "loading" && !data ? (
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 w-36 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : load.state === "error" ? (
          <ErrorBox message={load.message} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {orderedSources.map(({ source, count, last }) => (
              <SourceBadge
                key={source}
                source={source}
                count={count}
                last={last}
                active={activeSource === source}
                onClick={() => setActiveSource(activeSource === source ? null : source)}
              />
            ))}
            {orderedSources.length === 0 && (
              <p className="font-mono text-xs text-[var(--color-ink-faint)]">No intakes yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Recent stream */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
          {activeSource
            ? `Recent — ${getSource(activeSource).label}`
            : "Recent Intakes"}
        </p>
        {load.state === "loading" && !data ? (
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">Loading…</p>
        ) : filteredRecent.length === 0 ? (
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">
            {activeSource ? `No recent intakes from ${getSource(activeSource).label}.` : "No recent intakes."}
          </p>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {filteredRecent.map((item, i) => (
                <IntakeCard key={item.id} item={item} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Source Badge ──────────────────────────────────────────────────────────────
function SourceBadge({
  source,
  count,
  last,
  active,
  onClick,
}: {
  source: string;
  count: number;
  last: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const { label, color, Icon } = getSource(source);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-w-[120px] flex-col gap-1.5 rounded-2xl border px-4 py-3 text-left transition",
        active
          ? "border-white/20 bg-white/[0.07]"
          : "border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]"
      )}
      style={active ? { borderColor: `${color}55` } : undefined}
    >
      <div className="flex items-center gap-2">
        {/* Live dot */}
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
        />
        <span className="text-[11px] font-medium text-[var(--color-ink-dim)] group-hover:text-white transition" style={active ? { color } : undefined}>
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 pl-3.5">
        <span className="text-xl font-bold tabular-nums text-white">{count}</span>
        <span className="text-[10px] text-[var(--color-ink-faint)]">intakes</span>
      </div>
      <p className="pl-3.5 text-[10px] text-[var(--color-ink-faint)]">
        {last ? fmtDate(last) : "—"}
      </p>
    </button>
  );
}

// ── Intake Card ───────────────────────────────────────────────────────────────
function IntakeCard({ item, index }: { item: IntakeItem; index: number }) {
  const { label, color, Icon } = getSource(item.source);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.025, 0.2), ease: [0.2, 0.7, 0.2, 1] }}
      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 transition hover:border-white/20"
    >
      {/* Source icon */}
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}20`, color }}
      >
        <Icon size={12} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-relaxed text-[var(--color-ink)]">{item.snippet}</p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]"
            style={{ borderColor: `${color}55`, color }}
          >
            {label}
          </span>
          <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">{item.date}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Error Box ─────────────────────────────────────────────────────────────────
function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/5 p-4">
      <p className="text-sm font-medium text-white">NeuroSync unavailable</p>
      <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--color-ink-dim)]">{message}</p>
    </div>
  );
}

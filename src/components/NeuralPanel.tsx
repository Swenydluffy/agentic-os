"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Phone,
  MessageSquare,
  Zap,
  Activity,
  RefreshCw,
  Clock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";

const ACCENT = "#2dd4bf";

interface SourceStat {
  source: string;
  count: number;
  last: string | null;
}

interface IntakeItem {
  id: string;
  source: string;
  date: string;
  snippet: string;
}

interface NeurosyncData {
  ok: boolean;
  total: number;
  sources: SourceStat[];
  recent: IntakeItem[];
  syncedAt: string | null;
  error?: string;
}

type LoadState =
  | { state: "loading" }
  | { state: "ready"; data: NeurosyncData }
  | { state: "error"; detail: string };

// Source icon/color mapping
const SOURCE_META: Record<string, { label: string; color: string; icon: React.FC<{ size?: number }> }> = {
  phone: {
    label: "Phone",
    color: "#34d399",
    icon: ({ size = 13 }) => <Phone size={size} />,
  },
  telegram: {
    label: "Telegram",
    color: "#60a5fa",
    icon: ({ size = 13 }) => <MessageSquare size={size} />,
  },
  mind_insurance: {
    label: "Mind Ins.",
    color: "#a78bfa",
    icon: ({ size = 13 }) => <Brain size={size} />,
  },
  manual: {
    label: "Manual",
    color: "#fbbf24",
    icon: ({ size = 13 }) => <Zap size={size} />,
  },
  mission_control: {
    label: "Mission",
    color: "#f472b6",
    icon: ({ size = 13 }) => <Activity size={size} />,
  },
};

function getSourceMeta(source: string) {
  return (
    SOURCE_META[source] ?? {
      label: source.replace(/_/g, " "),
      color: "#94a3b8",
      icon: ({ size = 13 }: { size?: number }) => <Activity size={size} />,
    }
  );
}

function relativeTime(isoDate: string | null): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return isoDate.slice(0, 10);
  }
}

interface NeuralPanelProps {
  fullPage?: boolean;
  onBack?: () => void;
}

export function NeuralPanel({ fullPage = false, onBack }: NeuralPanelProps) {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const res = await fetch("/api/neurosync?limit=10");
      const data = (await res.json()) as NeurosyncData;
      if (data.ok) {
        setLoad({ state: "ready", data });
      } else {
        setLoad({ state: "error", detail: data.error ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      setLoad({ state: "error", detail: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const isReady = load.state === "ready";

  return (
    <div className={cn("panel flex flex-col overflow-hidden", fullPage ? "h-full" : "relative h-full")}>
      {/* Header */}
      {onBack && <div className="px-5 pt-4"><BackButton onBack={onBack} /></div>}
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: `${ACCENT}18` }}
          >
            <Brain size={15} style={{ color: ACCENT }} />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-white">
              NeuroSync
            </h2>
            {isReady && (
              <p className="text-[10px] text-[var(--color-ink-faint)]">
                {load.data.total} memories captured
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isReady && load.data.syncedAt && (
            <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">
              <Clock size={9} className="mr-1 inline" />
              {relativeTime(load.data.syncedAt)}
            </span>
          )}
          <button
            onClick={() => void fetchData()}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] text-[var(--color-ink-dim)] transition hover:bg-white/[0.08] hover:text-white"
          >
            <RefreshCw
              size={12}
              className={cn(load.state === "loading" && "animate-spin")}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Loading */}
        {load.state === "loading" && (
          <div className="flex h-32 items-center justify-center">
            <RefreshCw size={16} className="animate-spin text-[var(--color-ink-faint)]" />
            <span className="ml-2 text-sm text-[var(--color-ink-faint)]">Loading…</span>
          </div>
        )}

        {/* Error */}
        {load.state === "error" && (
          <div className="p-5">
            <p className="text-sm text-[var(--color-danger)]">
              ⚠ NeuroSync unreachable: {load.detail}
            </p>
            <button
              onClick={() => void fetchData()}
              className="mt-3 text-xs text-[var(--color-ink-dim)] underline hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Ready */}
        {load.state === "ready" && (
          <div className="space-y-0">
            {/* Source stats row */}
            {load.data.sources.length > 0 && (
              <div className="border-b border-white/5 px-5 py-4">
                <p className="mb-3 text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">
                  Sources
                </p>
                <div className="flex flex-wrap gap-2">
                  {load.data.sources.map((s) => {
                    const meta = getSourceMeta(s.source);
                    const Icon = meta.icon;
                    return (
                      <div
                        key={s.source}
                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5"
                        style={{
                          borderColor: `${meta.color}30`,
                          background: `${meta.color}10`,
                        }}
                      >
                        <span style={{ color: meta.color }}>
                          <Icon size={11} />
                        </span>
                        <span className="text-[11px] font-medium text-white/80">
                          {meta.label}
                        </span>
                        <span
                          className="rounded px-1 font-mono text-[10px] font-semibold"
                          style={{ color: meta.color, background: `${meta.color}20` }}
                        >
                          {s.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent intake */}
            {load.data.recent.length > 0 && (
              <div className="px-5 py-3">
                <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">
                  Recent Intake
                </p>
                <div className="space-y-1">
                  {load.data.recent.map((item) => {
                    const meta = getSourceMeta(item.source);
                    const Icon = meta.icon;
                    const isOpen = expanded === item.id;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="cursor-pointer rounded-xl border border-white/5 bg-white/[0.02] transition hover:bg-white/[0.05]"
                        onClick={() => setExpanded(isOpen ? null : item.id)}
                      >
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: `${meta.color}18`, color: meta.color }}
                          >
                            <Icon size={11} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] text-white/80">
                              {item.snippet || "(no content)"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">
                              {item.date ? item.date.slice(0, 10) : "—"}
                            </span>
                            <ChevronRight
                              size={11}
                              className={cn(
                                "text-[var(--color-ink-faint)] transition-transform",
                                isOpen && "rotate-90"
                              )}
                            />
                          </div>
                        </div>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden border-t border-white/5 px-3 py-2"
                            >
                              <p className="text-[11px] leading-relaxed text-[var(--color-ink-dim)]">
                                {item.snippet}
                              </p>
                              <p className="mt-1 font-mono text-[10px] text-[var(--color-ink-faint)]">
                                ID: {item.id} · source: {item.source}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {load.data.total === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Brain size={28} className="text-[var(--color-ink-faint)]" />
                <p className="text-sm text-[var(--color-ink-dim)]">No NeuroSync memories yet</p>
                <p className="text-xs text-[var(--color-ink-faint)]">
                  Memories captured from phone, Telegram, and Mind Insurance will appear here
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer total */}
      {load.state === "ready" && load.data.total > 0 && (
        <div className="border-t border-white/5 px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--color-ink-faint)]">
              {load.data.sources.length} active sources
            </span>
            <span
              className="font-mono text-[11px] font-semibold"
              style={{ color: ACCENT }}
            >
              {load.data.total} total
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

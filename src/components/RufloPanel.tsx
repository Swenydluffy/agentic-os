"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Waypoints,
  Play,
  Square,
  RefreshCw,
  Send,
  X,
  AlertTriangle,
  Cpu,
  Loader2,
} from "lucide-react";
import type { RufloAgent, RufloStatus } from "@/lib/ruflo";
import { cn } from "@/lib/utils";

const ACCENT = "#60a5fa";
const REFRESH_MS = 10_000;

/** POST /api/ruflo response for the launch/stop actions. */
interface ActionResponse {
  ok: boolean;
  error?: string;
  sessionKey?: string;
  stopped?: number;
}

type Banner = { kind: "ok" | "error"; text: string } | null;

const STATUS_META: Record<RufloAgent["status"], { label: string; color: string }> = {
  running: { label: "Running", color: ACCENT },
  idle: { label: "Idle", color: "var(--color-ink-faint)" },
  aborted: { label: "Aborted", color: "var(--color-amber)" },
  error: { label: "Error", color: "var(--color-danger)" },
};

export function RufloPanel() {
  const [status, setStatus] = useState<RufloStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [launching, setLaunching] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((b: Banner) => {
    setBanner(b);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    if (b) bannerTimer.current = setTimeout(() => setBanner(null), 5000);
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/ruflo", { signal, cache: "no-store" });
      const data = (await res.json()) as RufloStatus;
      setStatus(data);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setStatus({
        online: false,
        activeAgents: 0,
        targetAgents: 100,
        totalAgents: 0,
        agents: [],
        tasks: { total: 0, active: 0 },
        error: "Failed to reach Mission Control API",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + 10s auto-refresh.
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = setInterval(() => void refresh(controller.signal), REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [refresh]);

  function manualRefresh() {
    setRefreshing(true);
    void refresh();
  }

  async function launch() {
    const text = prompt.trim();
    if (!text || launching) return;
    setLaunching(true);
    try {
      const res = await fetch("/api/ruflo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "launch", prompt: text }),
      });
      const data = (await res.json()) as ActionResponse;
      if (data.ok) {
        flash({ kind: "ok", text: "Task launched — a new agent is on it." });
        setPrompt("");
        setComposerOpen(false);
        void refresh();
      } else {
        flash({ kind: "error", text: data.error ?? "Launch failed" });
      }
    } catch {
      flash({ kind: "error", text: "Launch request failed" });
    } finally {
      setLaunching(false);
    }
  }

  async function stopAll() {
    if (stopping) return;
    setStopping(true);
    try {
      const res = await fetch("/api/ruflo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stopAll" }),
      });
      const data = (await res.json()) as ActionResponse;
      if (data.ok) {
        flash({ kind: "ok", text: `Stopped ${data.stopped ?? 0} agent${data.stopped === 1 ? "" : "s"}.` });
        void refresh();
      } else {
        flash({ kind: "error", text: data.error ?? "Stop failed" });
      }
    } catch {
      flash({ kind: "error", text: "Stop request failed" });
    } finally {
      setStopping(false);
    }
  }

  const online = status?.online ?? false;
  const agents = status?.agents ?? [];

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <Waypoints size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Ruflo Swarm</h2>
            <p className="flex items-center gap-2 text-xs text-[var(--color-ink-dim)]">
              <StatusDot online={online} loading={loading} />
              {loading
                ? "Connecting to swarm…"
                : online
                  ? `Online${status?.version ? ` · v${status.version}` : ""} · localhost:18789`
                  : "Offline · localhost:18789"}
            </p>
          </div>
        </div>
        <button
          onClick={manualRefresh}
          aria-label="Refresh now"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-ink-dim)] transition hover:bg-white/[0.06] hover:text-white"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 px-5 pt-4 lg:grid-cols-4">
        <Stat
          label="Swarm"
          value={loading ? "…" : online ? "Online" : "Offline"}
          accent={online ? ACCENT : "var(--color-danger)"}
        />
        <Stat
          label="Active Agents"
          value={loading ? "…" : String(status?.activeAgents ?? 0)}
          suffix={`/ ${status?.targetAgents ?? 100}`}
          accent={ACCENT}
        />
        <Stat label="Total Sessions" value={loading ? "…" : String(status?.totalAgents ?? 0)} />
        <Stat label="Tasks Active" value={loading ? "…" : String(status?.tasks.active ?? 0)} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-5 pb-3 pt-4">
        <button
          onClick={() => setComposerOpen((v) => !v)}
          disabled={!online}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#04060d] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          <Play size={14} /> Launch Task
        </button>
        <button
          onClick={stopAll}
          disabled={!online || stopping}
          className="flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-sm font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {stopping ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />} Stop All
        </button>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
          auto-refresh · 10s
        </span>
      </div>

      {/* Launch composer */}
      <AnimatePresence initial={false}>
        {composerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden px-5"
          >
            <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-black/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
                  New agent task
                </span>
                <button
                  onClick={() => setComposerOpen(false)}
                  aria-label="Cancel"
                  className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-ink-faint)] transition hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void launch();
                  } else if (e.key === "Escape") {
                    setComposerOpen(false);
                  }
                }}
                rows={3}
                placeholder="Describe the task for a new agent to run…"
                className="resize-none rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-white/25"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-ink-faint)]">⌘↵ to launch</span>
                <button
                  onClick={launch}
                  disabled={!prompt.trim() || launching}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-[#04060d] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: ACCENT }}
                >
                  {launching ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Launch
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action banner */}
      <AnimatePresence initial={false}>
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              "mx-5 mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
              banner.kind === "ok"
                ? "border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
                : "border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]",
            )}
          >
            {banner.kind === "error" && <AlertTriangle size={13} />}
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent list */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 px-5 py-2.5">
        <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">Agents</span>
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[var(--color-ink-dim)]">
          {agents.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <Centered>
            <Loader2 size={18} className="animate-spin text-[var(--color-ink-dim)]" />
            <span className="text-sm text-[var(--color-ink-dim)]">Loading swarm…</span>
          </Centered>
        ) : !online ? (
          <Centered>
            <AlertTriangle size={18} className="text-[var(--color-danger)]" />
            <span className="max-w-sm text-center text-sm text-[var(--color-ink-dim)]">
              {status?.error ?? "Swarm is offline. Is the Ruflo gateway running on localhost:18789?"}
            </span>
          </Centered>
        ) : agents.length === 0 ? (
          <Centered>
            <Waypoints size={18} className="text-[var(--color-ink-faint)]" />
            <span className="text-sm text-[var(--color-ink-dim)]">No agents yet — launch a task to begin.</span>
          </Centered>
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {agents.map((agent) => (
                <AgentRow key={agent.id} agent={agent} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- pieces ---------------------------------- */

function AgentRow({ agent }: { agent: RufloAgent }) {
  const meta = STATUS_META[agent.status];
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              background: meta.color,
              boxShadow: agent.status === "running" ? `0 0 8px ${meta.color}` : undefined,
            }}
          />
          <span className="truncate text-sm font-medium text-white">{agent.name}</span>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]"
          style={{ background: `${meta.color}1f`, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>
      <p className="mt-1.5 truncate pl-4 text-xs text-[var(--color-ink-dim)]" title={agent.task}>
        {agent.task}
      </p>
      {(agent.model || agent.totalTokens > 0) && (
        <div className="mt-1.5 flex items-center gap-3 pl-4 text-[10px] text-[var(--color-ink-faint)]">
          {agent.model && (
            <span className="flex items-center gap-1">
              <Cpu size={10} /> {agent.model}
            </span>
          )}
          {agent.totalTokens > 0 && <span>{agent.totalTokens.toLocaleString()} tok</span>}
        </div>
      )}
    </motion.li>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold" style={{ color: accent ?? "#fff" }}>
        {value}
        {suffix && <span className="ml-1 text-xs font-normal text-[var(--color-ink-faint)]">{suffix}</span>}
      </p>
    </div>
  );
}

function StatusDot({ online, loading }: { online: boolean; loading: boolean }) {
  const color = loading ? "var(--color-amber)" : online ? "var(--color-lime)" : "var(--color-danger)";
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 py-12">{children}</div>;
}

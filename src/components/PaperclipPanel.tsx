"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Bot,
  ListTodo,
  ExternalLink,
  PlusCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type Tab = "company" | "agents" | "tasks";

interface MockAgent {
  role: string;
  name: string;
  online: boolean;
}

type PaperclipStatus = "connecting" | "online" | "offline";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const MOCK_AGENTS: MockAgent[] = [
  { role: "CEO", name: "Hermes", online: true },
  { role: "CTO", name: "Researcher", online: true },
  { role: "COO", name: "Architect", online: false },
];

const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: "company", label: "Company", icon: Building2 },
  { id: "agents",  label: "Agents",  icon: Bot },
  { id: "tasks",   label: "Tasks",   icon: ListTodo },
];

/* ------------------------------------------------------------------ */
/*  Status polling hook                                                 */
/* ------------------------------------------------------------------ */

function usePaperclipStatus(intervalMs = 30_000): PaperclipStatus {
  const [status, setStatus] = useState<PaperclipStatus>("connecting");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/paperclip-status", { cache: "no-store" });
        if (!cancelled) setStatus(res.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return status;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatusCard({ status }: { status: PaperclipStatus }) {
  const isConnecting = status === "connecting";
  const isOnline     = status === "online";

  const dotColor = isConnecting
    ? "#6b7280"
    : isOnline
    ? "#10b981"
    : "#f59e0b";

  const borderClass = isConnecting
    ? "border-white/10 bg-white/[0.02]"
    : isOnline
    ? "border-emerald-500/20 bg-emerald-500/[0.04]"
    : "border-amber-500/20 bg-amber-500/[0.04]";

  const textClass = isConnecting
    ? "text-white/60"
    : isOnline
    ? "text-emerald-400"
    : "text-amber-400";

  const label = isConnecting
    ? "Connecting…"
    : isOnline
    ? "Paperclip online"
    : "Paperclip unreachable";

  const sub = isConnecting
    ? "probing localhost:3100"
    : isOnline
    ? "localhost:3100 · reachable"
    : "check that Paperclip is running";

  return (
    <div className={cn("rounded-xl border p-3", borderClass)}>
      <div className="mb-1 flex items-center gap-2">
        {/* Pulsing status dot */}
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{
            background: dotColor,
            boxShadow: isConnecting ? "none" : `0 0 8px ${dotColor}`,
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">
          Paperclip
        </span>
      </div>
      <p className={cn("text-xs font-medium", textClass)}>{label}</p>
      <p className="mt-1 font-mono text-[10px] text-[var(--color-ink-faint)]">{sub}</p>
    </div>
  );
}

function CompanyTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Building2 size={32} className="text-[var(--color-ink-faint)]" />
      <p className="max-w-xs text-sm text-[var(--color-ink-dim)]">
        Your AI company will appear here once Paperclip is connected.
      </p>
    </div>
  );
}

function AgentsTab() {
  return (
    <ul className="flex flex-col gap-2">
      {MOCK_AGENTS.map(({ role, name, online }) => (
        <li
          key={role}
          className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3"
        >
          {/* Status dot */}
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{
              background: online ? "#10b981" : "#374151",
              boxShadow: online ? "0 0 8px #10b981" : "none",
            }}
          />
          <Bot size={14} className="flex-shrink-0 text-[var(--color-violet)]" />
          <span className="flex-1 text-sm text-white">{name}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
            {role}
          </span>
          <span
            className={cn(
              "text-[10px]",
              online ? "text-emerald-400" : "text-[var(--color-ink-faint)]"
            )}
          >
            {online ? "online" : "offline"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TasksTab() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <ListTodo size={32} className="text-[var(--color-ink-faint)]" />
      <p className="text-sm text-[var(--color-ink-dim)]">No active tasks</p>
      <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white">
        <PlusCircle size={14} />
        Assign Task
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                          */
/* ------------------------------------------------------------------ */

export function PaperclipPanel() {
  const [tab, setTab] = useState<Tab>("company");
  const status = usePaperclipStatus();

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30"
          style={{ boxShadow: "0 0 20px rgba(34,226,255,0.10) inset" }}
        >
          <Building2 size={18} style={{ color: "var(--color-cyan)" }} />
        </div>
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            Paperclip
            <Zap size={13} style={{ color: "var(--color-cyan)" }} />
          </h2>
          <p className="text-[11px] text-[var(--color-ink-dim)]">
            AI company OS · agent orchestration
          </p>
        </div>
      </div>

      {/* ── Status card ── */}
      <StatusCard status={status} />

      {/* ── Tabs ── */}
      <div className="rounded-xl border border-white/5 bg-black/20 p-1 flex gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition",
              tab === id
                ? "bg-white/[0.08] text-white"
                : "text-[var(--color-ink-dim)] hover:bg-white/[0.03] hover:text-white"
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 rounded-xl border border-white/5 bg-black/20 p-4">
        {tab === "company" && <CompanyTab />}
        {tab === "agents"  && <AgentsTab />}
        {tab === "tasks"   && <TasksTab />}
      </div>

      {/* ── Footer CTA ── */}
      <a
        href="https://paperclip.wynneops.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-gradient-to-br from-[var(--color-cyan)]/20 to-[var(--color-violet)]/20 px-4 py-3 text-sm font-medium text-white transition hover:from-[var(--color-cyan)]/35 hover:to-[var(--color-violet)]/35"
      >
        <ExternalLink size={14} />
        Open Paperclip Dashboard
      </a>
    </div>
  );
}

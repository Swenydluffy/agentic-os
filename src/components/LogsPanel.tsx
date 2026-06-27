"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, Clock, Bot, Cpu, RefreshCw, CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import { ACCENT, Spinner, ErrorState, VaultSaveBadge, useVaultSave } from "@/components/panel-ui";
import { localDateStamp } from "@/lib/date";
import { cn } from "@/lib/utils";

interface CronLog {
  name: string;
  lastRun: string | null;
  status: "ok" | "error" | "unknown" | "paused";
  output: string;
}
interface SessionLog {
  id: string;
  agent: string;
  started: string;
  durationMs: number;
  status: "completed" | "running" | "failed";
  summary: string;
}
interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  uptimeSeconds: number;
  totalMem: number;
  freeMem: number;
  usedMem: number;
  cpuCount: number;
  cpuModel: string;
  loadAvg: number[];
}
interface LogsData {
  cron: CronLog[];
  sessions: SessionLog[];
  system: SystemInfo;
}

type TabId = "cron" | "sessions" | "system";

const TABS: { id: TabId; label: string; icon: typeof Clock }[] = [
  { id: "cron", label: "Cron Jobs", icon: Clock },
  { id: "sessions", label: "Sessions", icon: Bot },
  { id: "system", label: "System", icon: Cpu },
];

/* ------------------------------- formatting ------------------------------- */

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 1 ? 1 : 0)} ${u[i]}`;
}
function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}
function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", `${m}m`].filter(Boolean).join(" ");
}
function relTime(iso: string | null): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Build the daily log snapshot note. */
function logsMarkdown(data: LogsData, stamp: string): string {
  const lines = [
    "---",
    `updated: ${new Date().toISOString()}`,
    "tags:",
    "  - agentic-os",
    "  - logs",
    "type: logs",
    "---",
    "",
    `# Logs · ${stamp}`,
    "",
    "## System",
    "",
    `- Host: ${data.system.hostname} (${data.system.platform}, ${data.system.arch})`,
    `- Node: ${data.system.nodeVersion}`,
    `- Uptime: ${formatUptime(data.system.uptimeSeconds)}`,
    `- Memory: ${formatBytes(data.system.usedMem)} / ${formatBytes(data.system.totalMem)} used`,
    `- CPU: ${data.system.cpuCount}× ${data.system.cpuModel} · load ${data.system.loadAvg.join(", ")}`,
    "",
    "## Cron Jobs",
    "",
  ];
  if (data.cron.length === 0) lines.push("_No cron logs._", "");
  for (const c of data.cron) {
    lines.push(`- **${c.name}** · ${c.status} · ${relTime(c.lastRun)}`);
  }
  lines.push("", "## Sessions", "");
  for (const s of data.sessions) {
    lines.push(`- **${s.agent}** · ${s.status} · ${formatDuration(s.durationMs)} — ${s.summary}`);
  }
  lines.push("");
  return lines.join("\n");
}

const STATUS_ICON = {
  ok: <CheckCircle2 size={13} className="text-[var(--color-lime)]" />,
  completed: <CheckCircle2 size={13} className="text-[var(--color-lime)]" />,
  error: <XCircle size={13} className="text-[var(--color-danger)]" />,
  failed: <XCircle size={13} className="text-[var(--color-danger)]" />,
  running: <CircleDashed size={13} className="spin text-[var(--color-cyan)]" />,
  unknown: <CircleDashed size={13} className="text-[var(--color-ink-faint)]" />,
  paused:  <CircleDashed size={13} style={{color: "#facc15"}} />,
} as const;

export function LogsPanel() {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<LogsData | null>(null);
  const [tab, setTab] = useState<TabId>("cron");
  const { status, save } = useVaultSave();

  const fetchData = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/logs");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load logs.");
      const d = json.data as LogsData;
      setData(d);
      setPhase("ready");
      // Auto-snapshot the day's logs to the vault on every load/refresh.
      const stamp = localDateStamp();
      save([{ section: "Logs", file: stamp, content: logsMarkdown(d, stamp) }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [save]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <ScrollText size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Logs</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">
              Cron, sessions &amp; system · daily snapshot to Obsidian
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase === "ready" && <VaultSaveBadge status={status} />}
          <button
            onClick={() => void fetchData()}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white"
          >
            <RefreshCw size={13} className={phase === "loading" ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/5 px-3 py-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                active ? "text-white" : "text-[var(--color-ink-dim)] hover:text-white",
              )}
            >
              {active && (
                <motion.span
                  layoutId="logs-tab"
                  className="absolute inset-0 rounded-lg border border-white/10"
                  style={{ background: `${ACCENT}1a`, boxShadow: `0 0 0 1px ${ACCENT}55 inset` }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon size={14} className="relative z-10" style={active ? { color: ACCENT } : undefined} />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {phase === "loading" ? (
          <Spinner label="Reading logs…" />
        ) : phase === "error" ? (
          <ErrorState error={error} onRetry={() => void fetchData()} />
        ) : !data ? null : tab === "cron" ? (
          <ul className="space-y-2">
            {data.cron.map((c) => (
              <li key={c.name} className="fade-in rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-white">
                    {STATUS_ICON[c.status]}
                    <span className="font-mono">{c.name}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
                    {relTime(c.lastRun)}
                  </span>
                </div>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--color-ink-dim)]">
                  {c.output}
                </pre>
              </li>
            ))}
          </ul>
        ) : tab === "sessions" ? (
          <ul className="space-y-2">
            {data.sessions.map((s) => (
              <li key={s.id} className="fade-in rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-white">
                    {STATUS_ICON[s.status]}
                    {s.agent}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--color-ink-faint)]">
                    {formatDuration(s.durationMs)} · {relTime(s.started)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-dim)]">{s.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <SystemTab system={data.system} />
        )}
      </div>
    </div>
  );
}

function SystemTab({ system }: { system: SystemInfo }) {
  const memPct = system.totalMem ? Math.round((system.usedMem / system.totalMem) * 100) : 0;
  const rows: [string, string][] = [
    ["Hostname", system.hostname],
    ["Platform", `${system.platform} · ${system.arch}`],
    ["Node", system.nodeVersion],
    ["Uptime", formatUptime(system.uptimeSeconds)],
    ["CPU", `${system.cpuCount}× ${system.cpuModel}`],
    ["Load avg", system.loadAvg.join("  ·  ")],
  ];
  return (
    <div className="space-y-4 fade-in">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-[var(--color-ink-dim)]">Memory</span>
          <span className="font-mono text-white">
            {formatBytes(system.usedMem)} / {formatBytes(system.totalMem)} · {memPct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full"
            style={{ width: `${memPct}%`, background: `linear-gradient(90deg, ${ACCENT}, var(--color-violet))` }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
          >
            <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">{k}</dt>
            <dd className="mt-0.5 truncate font-mono text-sm text-white" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

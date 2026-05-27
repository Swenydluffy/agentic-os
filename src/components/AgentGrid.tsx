"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Power, Pause, Play, Zap, ChevronRight } from "lucide-react";
import { snapshotAgents, type AgentSnapshot, type AgentStatus } from "@/lib/agents";
import { AgentAvatar } from "./AgentAvatar";
import { cn } from "@/lib/utils";

const ACCENT_COLOR: Record<string, string> = {
  cyan: "#22e2ff",
  violet: "#9b6bff",
  magenta: "#ff3ec1",
  lime: "#b9ff66",
  amber: "#ffb547",
};

const STATUS_META: Record<AgentStatus, { color: string; label: string }> = {
  online: { color: "var(--color-lime)", label: "ONLINE" },
  thinking: { color: "var(--color-cyan)", label: "THINKING" },
  idle: { color: "var(--color-ink-dim)", label: "IDLE" },
  offline: { color: "var(--color-ink-faint)", label: "OFFLINE" },
  error: { color: "var(--color-danger)", label: "ERROR" },
};

export function AgentGrid({
  onSelect,
  selectedId,
}: {
  onSelect: (id: string) => void;
  selectedId?: string | null;
}) {
  const [tick, setTick] = useState(0);
  const agents = useMemo(() => snapshotAgents(7 + tick), [tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel relative flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-wide text-white">
            Agent Constellation
          </h2>
          <p className="text-xs text-[var(--color-ink-dim)]">
            {agents.filter((a) => a.status !== "offline").length} of {agents.length} active · live telemetry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white">
            <Zap size={11} className="mr-1 inline" /> Dispatch
          </button>
          <button className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white">
            All Agents <ChevronRight size={11} className="ml-1 inline" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
        {agents.map((a, i) => (
          <AgentCard
            key={a.id}
            agent={a}
            index={i}
            isSelected={selectedId === a.id}
            onSelect={() => onSelect(a.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  index,
  isSelected,
  onSelect,
}: {
  agent: AgentSnapshot;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = ACCENT_COLOR[agent.accent] ?? "#22e2ff";
  const status = STATUS_META[agent.status];

  return (
    <motion.button
      onClick={onSelect}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 * index, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-4 text-left transition",
        "hover:border-white/20"
      )}
      style={{
        boxShadow: isSelected
          ? `0 0 0 1px ${color}, 0 0 30px ${color}55`
          : undefined,
      }}
    >
      {/* Edge highlight */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl transition group-hover:opacity-60"
        style={{ background: color }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <AgentAvatar agent={agent} size={44} status={agent.status} />
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="font-display text-base font-semibold tracking-wide text-white">
                {agent.name}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
                /{agent.id}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-ink-dim)]">{agent.description}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em]"
            style={{
              color: status.color,
              background: `${status.color}14`,
              border: `1px solid ${status.color}33`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: status.color, boxShadow: `0 0 8px ${status.color}` }}
            />
            {status.label}
          </span>
        </div>
      </div>

      <div className="relative mt-3 flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
          task
        </span>
        <span className="truncate font-mono text-xs text-white/80">{agent.task}</span>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Load" value={`${Math.round(agent.load * 100)}%`} bar={agent.load} color={color} />
        <Stat label="Latency" value={`${agent.latencyMs}ms`} bar={agent.latencyMs / 1200} color={color} />
        <Stat label="Tokens" value={`${(agent.tokensOut / 1000).toFixed(1)}k`} bar={Math.min(1, agent.tokensOut / 60000)} color={color} />
      </div>

      <div className="relative mt-3 flex items-center justify-between border-t border-white/5 pt-3 text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
        <span className="font-mono">{agent.model}</span>
        <div className="flex items-center gap-1">
          <Mini icon={<Play size={10} />} />
          <Mini icon={<Pause size={10} />} />
          <Mini icon={<Power size={10} />} />
        </div>
      </div>
    </motion.button>
  );
}

function Stat({
  label,
  value,
  bar,
  color,
}: {
  label: string;
  value: string;
  bar: number;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, bar * 100));
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">{label}</p>
      <p className="mt-0.5 font-mono text-xs tabular text-white">{value}</p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </div>
  );
}

function Mini({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)] transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white">
      {icon}
    </span>
  );
}

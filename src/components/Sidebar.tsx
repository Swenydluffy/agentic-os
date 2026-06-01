"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  LayoutGrid, Bot, MessageSquare, ScrollText, Settings, Workflow,
  Radio, Boxes, Target, NotebookPen, BookOpen, Zap, BrainCircuit,
  NotebookTabs, Route, KanbanSquare, Waypoints, Hash, KeyRound,
  Brain, NotebookText, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  accent?: string;
}

const NAV: NavItem[] = [
  { id: "mission", label: "Mission Control", icon: LayoutGrid },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "chat", label: "Claude Console", icon: MessageSquare },
  { id: "hermes", label: "Hermes", icon: Zap },
  { id: "models", label: "Models", icon: BrainCircuit, accent: "#60a5fa" },
  { id: "notebook", label: "Notebook", icon: NotebookTabs, accent: "#fde047" },
  { id: "router", label: "Pareto Router", icon: Route, accent: "#60a5fa" },
  { id: "kanban", label: "Kanban", icon: KanbanSquare, accent: "#60a5fa" },
  { id: "ruflo", label: "Ruflo Swarm", icon: Waypoints, accent: "#60a5fa" },
  { id: "twitter", label: "X Search", icon: Hash, accent: "#60a5fa" },
  { id: "secrets", label: "Secrets Vault", icon: KeyRound, accent: "#fbbf24" },
  { id: "omi", label: "OMI", icon: Brain, accent: "#2dd4bf" },
  { id: "obsidian", label: "Obsidian", icon: NotebookText, accent: "#8b5cf6" },
  { id: "goals", label: "Goals", icon: Target },
  { id: "journal", label: "Journal", icon: NotebookPen },
  { id: "guide", label: "Guide", icon: BookOpen },
  { id: "workflows", label: "Workflows", icon: Workflow, accent: "#60a5fa" },
  { id: "telemetry", label: "Telemetry", icon: Radio },
  { id: "memory", label: "Memory", icon: Boxes, accent: "#60a5fa" },
  { id: "logs", label: "Logs", icon: ScrollText, accent: "#60a5fa" },
];

interface HealthData {
  ok: boolean;
  status: string;
  healthy: number;
  total: number;
  totalMs: number;
}

function useHealth(intervalMs = 60_000): HealthData | null {
  const [health, setHealth] = useState<HealthData | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth({ ok: false, status: "Health check failed", healthy: 0, total: 0, totalMs: 0 });
      }
    }
    poll();
    const id = setInterval(poll, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs]);
  return health;
}

export function Sidebar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  const health = useHealth();
  const statusText = health?.status ?? "Checking systems…";
  const uptimeText = health
    ? `${health.healthy}/${health.total} services · ${health.totalMs}ms`
    : "connecting…";

  return (
    <motion.aside
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative z-20 flex w-[240px] shrink-0 flex-col gap-1 border-r border-white/5 bg-black/20 px-3 py-5 backdrop-blur-xl"
    >
      <div className="px-3 pb-3 pt-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">Operator</p>
        <p className="mt-1 font-mono text-sm text-white">lucyanne@local</p>
      </div>
      <div className="px-3 pb-2 pt-3 text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">Modules</div>
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        const accent = item.accent ?? "var(--color-cyan)";
        return (
          <button
            key={item.id}
onClick={() => onSelect(item.id)}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
              isActive ? "text-white" : "text-[var(--color-ink-dim)] hover:bg-white/[0.03] hover:text-white"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.07] via-white/[0.04] to-transparent"
                style={{ boxShadow: "0 0 24px rgba(155,107,255,0.16) inset" }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <Icon size={16} className="relative z-10" style={item.accent && isActive ? { color: item.accent } : undefined} />
            <span className="relative z-10 tracking-wide">{item.label}</span>
            {isActive && (
              <span className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
            )}
          </button>
        );
      })}
      <div className="mt-auto px-3 pb-1">
        <button
          onClick={() => onSelect("settings")}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
            active === "settings" ? "bg-white/[0.06] text-white" : "text-[var(--color-ink-dim)] hover:bg-white/[0.03] hover:text-white"
          )}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
        <div className={cn(
          "mt-3 rounded-xl border p-3",
          health === null ? "border-white/10 bg-white/[0.02]"
            : health.ok ? "border-emerald-500/20 bg-emerald-500/[0.04]"
            : "border-amber-500/20 bg-amber-500/[0.04]"
        )}>
          <div className="mb-1 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: health === null ? "#666" : health.ok ? "#10b981" : "#f59e0b",
                boxShadow: health === null ? "none" : health.ok ? "0 0 8px #10b981" : "0 0 8px #f59e0b",
                animation: "pulse 2s ease-in-out infinite",
              }}
            />
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">Bridge</span>
          </div>
          <p className={cn(
            "text-xs",
            health === null ? "text-white/60" : health.ok ? "text-emerald-400" : "text-amber-400"
          )}>{statusText}</p>
          <p className="mt-1 font-mono text-[10px] text-[var(--color-ink-faint)]">{uptimeText}</p>
        </div>
      </div>
    </motion.aside>
  );
}

"use client";

import { motion } from "framer-motion";
import {
  LayoutGrid,
  Bot,
  MessageSquare,
  ScrollText,
  Settings,
  Workflow,
  Radio,
  Boxes,
  Target,
  NotebookPen,
  BookOpen,
  Zap,
  BrainCircuit,
  Notebook,
  Route,
  KanbanSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Optional accent colour for the active indicator (defaults to cyan). */
  accent?: string;
}

const NAV: NavItem[] = [
  { id: "mission", label: "Mission Control", icon: LayoutGrid },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "chat", label: "Claude Console", icon: MessageSquare },
  { id: "hermes", label: "Hermes", icon: Zap },
  { id: "models", label: "Models", icon: BrainCircuit, accent: "#60a5fa" },
  { id: "notebooklm", label: "NotebookLM", icon: Notebook, accent: "#60a5fa" },
  { id: "router", label: "Pareto Router", icon: Route, accent: "#60a5fa" },
  { id: "kanban", label: "Kanban", icon: KanbanSquare, accent: "#60a5fa" },
  { id: "goals", label: "Goals", icon: Target },
  { id: "journal", label: "Journal", icon: NotebookPen },
  { id: "guide", label: "Guide", icon: BookOpen },
  { id: "workflows", label: "Workflows", icon: Workflow },
  { id: "telemetry", label: "Telemetry", icon: Radio },
  { id: "memory", label: "Memory", icon: Boxes },
  { id: "logs", label: "Logs", icon: ScrollText },
];

export function Sidebar({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <motion.aside
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative z-20 flex w-[240px] shrink-0 flex-col gap-1 border-r border-white/5 bg-black/20 px-3 py-5 backdrop-blur-xl"
    >
      <div className="px-3 pb-3 pt-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">
          Operator
        </p>
        <p className="mt-1 font-mono text-sm text-white">lucyanne@local</p>
      </div>

      <div className="px-3 pb-2 pt-3 text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">
        Modules
      </div>

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
              isActive
                ? "text-white"
                : "text-[var(--color-ink-dim)] hover:bg-white/[0.03] hover:text-white"
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
            <Icon
              size={16}
              className="relative z-10"
              style={item.accent && isActive ? { color: item.accent } : undefined}
            />
            <span className="relative z-10 tracking-wide">{item.label}</span>
            {isActive && (
              <span
                className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full"
                style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
              />
            )}
          </button>
        );
      })}

      <div className="mt-auto px-3 pb-1">
        <button
          onClick={() => onSelect("settings")}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
            active === "settings"
              ? "bg-white/[0.06] text-white"
              : "text-[var(--color-ink-dim)] hover:bg-white/[0.03] hover:text-white"
          )}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>

        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="pulse-dot" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">
              Bridge
            </span>
          </div>
          <p className="text-xs text-white">All systems nominal</p>
          <p className="mt-1 font-mono text-[10px] text-[var(--color-ink-faint)]">
            uptime · 12d 04h 17m
          </p>
        </div>
      </div>
    </motion.aside>
  );
}

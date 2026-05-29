"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Bot,
  MessageSquare,
  LayoutGrid,
  Zap,
  Workflow,
  Radio,
  ScrollText,
  Boxes,
  BrainCircuit,
  ArrowRight,
} from "lucide-react";
import { AGENTS } from "@/lib/agents";

type Cmd = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  action: () => void;
  group: "Navigation" | "Agents" | "Actions";
};

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onPickAgent,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onPickAgent: (id: string) => void;
}) {
  const [q, setQ] = useState("");

  const cmds = useMemo<Cmd[]>(
    () => [
      { id: "mission", group: "Navigation", label: "Mission Control", hint: "overview", icon: <LayoutGrid size={14} />, action: () => onNavigate("mission") },
      { id: "agents", group: "Navigation", label: "Agents", hint: "full constellation", icon: <Bot size={14} />, action: () => onNavigate("agents") },
      { id: "chat", group: "Navigation", label: "Claude Console", hint: "direct line", icon: <MessageSquare size={14} />, action: () => onNavigate("chat") },
      { id: "models", group: "Navigation", label: "Models", hint: "switch AI model", icon: <BrainCircuit size={14} />, action: () => onNavigate("models") },
      { id: "workflows", group: "Navigation", label: "Workflows", hint: "pipelines", icon: <Workflow size={14} />, action: () => onNavigate("workflows") },
      { id: "telemetry", group: "Navigation", label: "Telemetry", hint: "metrics", icon: <Radio size={14} />, action: () => onNavigate("telemetry") },
      { id: "memory", group: "Navigation", label: "Memory", hint: "embeddings + recall", icon: <Boxes size={14} />, action: () => onNavigate("memory") },
      { id: "logs", group: "Navigation", label: "Logs", hint: "activity stream", icon: <ScrollText size={14} />, action: () => onNavigate("logs") },
      ...AGENTS.map<Cmd>((a) => ({
        id: `agent-${a.id}`,
        group: "Agents",
        label: a.name,
        hint: a.description,
        icon: <Zap size={14} />,
        action: () => onPickAgent(a.id),
      })),
    ],
    [onNavigate, onPickAgent]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cmds;
    return cmds.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        c.hint.toLowerCase().includes(needle) ||
        c.group.toLowerCase().includes(needle)
    );
  }, [q, cmds]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const groups = useMemo(() => {
    const map = new Map<string, Cmd[]>();
    filtered.forEach((c) => {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <motion.div
            initial={{ y: -10, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="panel relative z-10 w-[640px] max-w-[92vw] overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
              <Search size={16} className="text-[var(--color-cyan)]" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Jump to anything…"
                className="flex-1 bg-transparent text-base text-white outline-none placeholder:text-[var(--color-ink-faint)]"
              />
              <kbd className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-ink-dim)]">ESC</kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {groups.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-[var(--color-ink-dim)]">
                  No matches.
                </p>
              )}
              {groups.map(([group, items]) => (
                <div key={group}>
                  <p className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">
                    {group}
                  </p>
                  {items.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        c.action();
                        onClose();
                      }}
                      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/[0.05]"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[var(--color-ink-dim)] group-hover:text-white">
                        {c.icon}
                      </span>
                      <span className="flex-1">
                        <span className="text-white">{c.label}</span>
                        <span className="ml-2 text-xs text-[var(--color-ink-dim)]">
                          {c.hint}
                        </span>
                      </span>
                      <ArrowRight size={14} className="opacity-0 transition group-hover:opacity-60" />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

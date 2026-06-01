"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

type Entry = {
  id: string;
  ts: string;
  agent: string;
  level: "info" | "ok" | "warn" | "err";
  msg: string;
};

const SAMPLE: Omit<Entry, "id" | "ts">[] = [
  { agent: "orchestrator", level: "info", msg: "Routing 'review billing module' → Architect" },
  { agent: "researcher", level: "ok", msg: "Indexed 1,284 documents · embeddings updated" },
  { agent: "architect", level: "info", msg: "Draft ADR-0042 written to memory:adr/0042" },
  { agent: "coder", level: "ok", msg: "Committed 14 files · build succeeded in 12.3s" },
  { agent: "tester", level: "warn", msg: "Coverage dropped 1.4% in /src/billing — flagged" },
  { agent: "sentinel", level: "ok", msg: "0 high-severity findings in dependency scan" },
  { agent: "ops", level: "info", msg: "Deploy plan staged · awaiting confirmation" },
  { agent: "memoria", level: "ok", msg: "Episodic memory compacted · 312MB → 184MB" },
  { agent: "scout", level: "info", msg: "Detected new file: src/components/RewardChart.tsx" },
  { agent: "reviewer", level: "warn", msg: "Pattern drift on PR #318 — suggesting refactor" },
  { agent: "orchestrator", level: "ok", msg: "Consensus reached · 3/3 reviewers approved" },
  { agent: "researcher", level: "info", msg: "Cross-referencing 7 sources for hypothesis Δ" },
  { agent: "sentinel", level: "err", msg: "Anomalous token usage on /agent/scout" },
];

const COLOR: Record<Entry["level"], string> = {
  info: "var(--color-cyan)",
  ok: "var(--color-lime)",
  warn: "var(--color-amber)",
  err: "var(--color-danger)",
};

function ts() {
  const d = new Date();
  return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
}

/**
 * Time-dependent text can't be rendered during SSR/hydration without a mismatch
 * (the server and client compute `ts()` at different instants). Render a stable
 * placeholder until mounted, then reveal the real timestamp — so the server HTML
 * and the first client render agree, and React hydrates cleanly.
 */
function Timestamp({ value }: { value: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <span className="shrink-0 text-[var(--color-ink-faint)]">
      {mounted ? value : "--:--:--.---"}
    </span>
  );
}

export function ActivityLog() {
  const [items, setItems] = useState<Entry[]>(() =>
    SAMPLE.slice(0, 6).map((s) => ({ ...s, id: crypto.randomUUID(), ts: ts() }))
  );

  useEffect(() => {
    const id = setInterval(() => {
      const pick = SAMPLE[Math.floor(Math.random() * SAMPLE.length)];
      setItems((prev) => [
        { ...pick, id: crypto.randomUUID(), ts: ts() },
        ...prev,
      ].slice(0, 50));
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[var(--color-lime)]" />
          <h2 className="font-display text-base font-semibold tracking-wide text-white">
            Live Activity
          </h2>
        </div>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">
          <span className="pulse-dot" /> streaming
        </span>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3 font-mono text-[11px]">
        <AnimatePresence initial={false}>
          {items.map((e) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.02]"
            >
              <Timestamp value={e.ts} />
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em]"
                style={{
                  color: COLOR[e.level],
                  background: `${COLOR[e.level]}14`,
                  border: `1px solid ${COLOR[e.level]}33`,
                }}
              >
                {e.level}
              </span>
              <span className="shrink-0 text-[var(--color-violet)]">@{e.agent}</span>
              <span className="truncate text-white/85">{e.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

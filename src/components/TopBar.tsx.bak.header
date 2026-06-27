"use client";

import { motion } from "framer-motion";
import { Activity, Wifi, Cpu, MemoryStick, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useActiveModel } from "@/lib/useActiveModel";

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function useDriftingMetric(base: number, variance: number, intervalMs = 1500) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setV((prev) => {
        const next = prev + (Math.random() - 0.5) * variance;
        return Math.max(2, Math.min(98, next));
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [variance, intervalMs]);
  return v;
}

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const now = useNow();
  const cpu = useDriftingMetric(34, 8);
  const mem = useDriftingMetric(58, 4);
  const tok = useDriftingMetric(72, 12, 900);
  const { model } = useActiveModel();

  const time = now
    ? now.toLocaleTimeString("en-US", { hour12: false })
    : "--:--:--";
  const date = now
    ? now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative z-30 flex h-16 items-center gap-6 border-b border-white/5 px-6 backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        <Logo />
        <div className="flex flex-col leading-none">
          <span className="text-[11px] uppercase tracking-[0.32em] text-[var(--color-ink-faint)]">
            Mission Control
          </span>
          <span className="text-sm font-semibold tracking-wide hue">
            C · M · C
          </span>
        </div>
      </div>

      <div className="mx-4 h-8 w-px bg-white/10" />

      <button
        onClick={onOpenPalette}
        className="group flex h-10 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-[var(--color-ink-dim)] transition hover:border-white/20 hover:bg-white/[0.06]"
      >
        <Search size={14} className="opacity-60" />
        <span className="flex-1 text-left">Command anything · ask Claude, launch agents, jump panels…</span>
        <kbd className="hidden rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-ink-dim)] md:inline">⌘K</kbd>
      </button>

      <div className="hidden items-center gap-5 lg:flex">
        <Metric icon={<Cpu size={12} />} label="CPU" value={cpu} accent="cyan" />
        <Metric icon={<MemoryStick size={12} />} label="MEM" value={mem} accent="violet" />
        <Metric icon={<Activity size={12} />} label="TOK/s" value={tok} accent="magenta" />
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <span
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] tracking-wider text-[var(--color-ink-dim)]"
          title={`Active model · ${model.name} (${model.providerLabel})`}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: model.color, boxShadow: `0 0 8px ${model.color}` }}
          />
          <span className="font-mono uppercase">{model.shortName}</span>
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] tracking-wider text-[var(--color-ink-dim)]">
          <Wifi size={12} className="text-[var(--color-lime)]" />
          <span className="font-mono uppercase">Online</span>
        </span>
        <div className="flex flex-col items-end leading-none">
          <span className="font-mono text-sm tabular text-white">{time}</span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">{date}</span>
        </div>
      </div>
    </motion.header>
  );
}

function Logo() {
  return (
    <div className="relative h-9 w-9">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[var(--color-cyan)] via-[var(--color-violet)] to-[var(--color-magenta)] opacity-90 blur-[2px]" />
      <div className="absolute inset-[2px] rounded-[10px] bg-[#04060d]" />
      <Sparkles
        size={16}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white"
      />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: "cyan" | "violet" | "magenta";
}) {
  const color =
    accent === "cyan"
      ? "var(--color-cyan)"
      : accent === "violet"
        ? "var(--color-violet)"
        : "var(--color-magenta)";
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]" style={{ color }}>
        {icon}
      </span>
      <div className="flex flex-col leading-none">
        <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">{label}</span>
        <span className="font-mono text-xs tabular text-white">{value.toFixed(0)}%</span>
      </div>
      <div className="ml-1 h-2 w-16 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

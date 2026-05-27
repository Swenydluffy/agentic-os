"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Coins, Gauge, Sparkles, Zap, Server } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { Sidebar } from "@/components/Sidebar";
import { StatTile } from "@/components/StatTile";
import { AgentGrid } from "@/components/AgentGrid";
import { ChatPanel } from "@/components/ChatPanel";
import { AgentChat } from "@/components/AgentChat";
import { ActivityLog } from "@/components/ActivityLog";
import { NeuralPanel } from "@/components/NeuralPanel";
import { CommandPalette } from "@/components/CommandPalette";

function drift(seed: number, n = 24, base = 50, range = 30) {
  const arr: number[] = [];
  let s = seed;
  let v = base;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    v += (s / 233280 - 0.5) * range * 0.5;
    v = Math.max(base - range, Math.min(base + range, v));
    arr.push(v);
  }
  return arr;
}

export default function Page() {
  const [activeNav, setActiveNav] = useState("mission");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sparks = useMemo(
    () => ({
      agents: drift(11, 24, 9, 4),
      tasks: drift(23, 24, 140, 80),
      tokens: drift(41, 24, 60, 40),
      latency: drift(59, 24, 420, 220),
    }),
    []
  );

  const view: "console" | "dashboard" =
    activeNav === "agents" || activeNav === "chat" ? "console" : "dashboard";

  function openAgent(id: string) {
    setSelectedAgent(id);
    setActiveNav("agents");
  }

  return (
    <main className="relative z-10 flex h-screen w-screen overflow-hidden">
      <Sidebar active={activeNav} onSelect={setActiveNav} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />

        <div className="relative flex-1 overflow-hidden">
          {/* Console stays mounted so conversations survive view switches. */}
          <div className={view === "console" ? "h-full p-4 lg:p-6" : "hidden"}>
            <AgentChat initialAgentId={selectedAgent} />
          </div>

          <div className={view === "dashboard" ? "h-full" : "hidden"}>
          <div className="grid h-full grid-cols-12 gap-4 overflow-y-auto p-4 lg:p-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
              className="col-span-12 flex items-center justify-between"
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--color-ink-faint)]">
                  Bridge · live
                </p>
                <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
                  <span className="text-white">Good evening, </span>
                  <span className="hue">commander</span>
                  <span className="text-white">.</span>
                </h1>
                <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
                  Fleet is humming. Three open threads. Want to push the new build before midnight?
                </p>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <PrimaryAction icon={<Zap size={14} />} label="Launch Workflow" />
                <SecondaryAction icon={<Sparkles size={14} />} label="Ask Claude" />
              </div>
            </motion.div>

            <div className="col-span-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                label="Agents Online"
                value={9}
                suffix="/ 10"
                delta={2.4}
                spark={sparks.agents}
                accent="lime"
                icon={<Bot size={12} />}
              />
              <StatTile
                label="Tasks · 24h"
                value={147}
                delta={18.6}
                spark={sparks.tasks}
                accent="cyan"
                icon={<Gauge size={12} />}
              />
              <StatTile
                label="Tokens Burned"
                value={482000}
                delta={-4.2}
                spark={sparks.tokens}
                accent="violet"
                icon={<Coins size={12} />}
              />
              <StatTile
                label="Avg Latency"
                value={412}
                suffix="ms"
                delta={-9.1}
                spark={sparks.latency}
                accent="magenta"
                icon={<Server size={12} />}
              />
            </div>

            <div className="col-span-12 lg:col-span-7 xl:col-span-8">
              <div className="h-[560px]">
                <AgentGrid selectedId={selectedAgent} onSelect={openAgent} />
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 xl:col-span-4">
              <div className="h-[560px]">
                <ChatPanel pinnedAgent={selectedAgent} />
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5 xl:col-span-4">
              <div className="h-[360px]">
                <NeuralPanel />
              </div>
            </div>

            <div className="col-span-12 lg:col-span-7 xl:col-span-8">
              <div className="h-[360px]">
                <ActivityLog />
              </div>
            </div>

            <div className="col-span-12">
              <Ticker />
            </div>
          </div>
          </div>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={setActiveNav}
        onPickAgent={openAgent}
      />
    </main>
  );
}

function PrimaryAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[var(--color-cyan)]/25 to-[var(--color-violet)]/25 px-4 py-2 text-sm font-medium text-white transition hover:from-[var(--color-cyan)]/40 hover:to-[var(--color-violet)]/40">
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative flex items-center gap-2">
        {icon}
        {label}
      </span>
    </button>
  );
}

function SecondaryAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white">
      {icon}
      {label}
    </button>
  );
}

function Ticker() {
  const items = [
    "ORCHESTRATOR · routing 4 tasks",
    "ARCHITECT · drafting ADR-0042",
    "SENTINEL · scanning supply chain (clean)",
    "MEMORIA · 312MB → 184MB compacted",
    "OPS · staging deploy queued",
    "RESEARCHER · indexed 1,284 docs",
    "CODER · 14 files committed, build passed",
    "REVIEWER · approved PR #318",
    "TESTER · 92.4% coverage",
    "SCOUT · 7 new files detected",
  ];
  const doubled = [...items, ...items];

  return (
    <div className="panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#04060d] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#04060d] to-transparent" />

      <div className="flex items-center gap-3 px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-amber)]">
          FLEET FEED
        </span>
        <span className="h-1 w-1 rounded-full bg-[var(--color-amber)]" />
        <div className="relative flex-1 overflow-hidden">
          <div className="marquee">
            {doubled.map((t, i) => (
              <span
                key={i}
                className="flex items-center gap-3 font-mono text-[11px] tracking-wide text-[var(--color-ink-dim)]"
              >
                <span className="h-1 w-1 rounded-full bg-[var(--color-cyan)]" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Boxes, User, Bot, Plus, Trash2 } from "lucide-react";
import {
  ACCENT,
  Spinner,
  ErrorState,
  EmptyState,
  VaultSaveBadge,
  useVaultSave,
} from "@/components/panel-ui";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";

interface MemoryCard {
  id: string;
  title: string;
  content: string;
}

type TabId = "profile" | "agent";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "profile", label: "User Profile", icon: User },
  { id: "agent", label: "Agent Memory", icon: Bot },
];

/** Render a set of memory cards as an Obsidian note. */
function memoryMarkdown(heading: string, tag: string, cards: MemoryCard[]): string {
  const lines = [
    "---",
    `updated: ${new Date().toISOString()}`,
    "tags:",
    "  - agentic-os",
    "  - memory",
    `  - ${tag}`,
    "type: memory",
    "---",
    "",
    `# ${heading}`,
    "",
  ];
  if (cards.length === 0) lines.push("_No entries yet._", "");
  for (const c of cards) {
    lines.push(`## ${c.title.trim() || "Untitled"}`, "", c.content.trim() || "_(empty)_", "");
  }
  return lines.join("\n");
}

interface MemoryPanelProps { onBack?: () => void; }
export function MemoryPanel({ onBack }: MemoryPanelProps = {}){
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<MemoryCard[]>([]);
  const [agent, setAgent] = useState<MemoryCard[]>([]);
  const [tab, setTab] = useState<TabId>("profile");
  const { status, save } = useVaultSave();

  const fetchData = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/memory");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load memory.");
      setProfile(json.data.userProfile ?? []);
      setAgent(json.data.agentMemory ?? []);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /** Persist both stores: JSON (source of truth) + two Obsidian notes. */
  const commit = useCallback(
    (nextProfile: MemoryCard[], nextAgent: MemoryCard[]) => {
      setProfile(nextProfile);
      setAgent(nextAgent);
      void fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userProfile: nextProfile, agentMemory: nextAgent }),
      });
      save([
        { section: "Memory", file: "user-profile", content: memoryMarkdown("User Profile", "user-profile", nextProfile) },
        { section: "Memory", file: "agent-memory", content: memoryMarkdown("Agent Memory", "agent-memory", nextAgent) },
      ]);
    },
    [save],
  );

  const cards = tab === "profile" ? profile : agent;
  const setCards = (next: MemoryCard[]) =>
    tab === "profile" ? commit(next, agent) : commit(profile, next);

  function addCard() {
    setCards([...cards, { id: crypto.randomUUID(), title: "", content: "" }]);
  }
  function updateCard(id: string, patch: Partial<MemoryCard>) {
    setCards(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCard(id: string) {
    setCards(cards.filter((c) => c.id !== id));
  }

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      {onBack && <div style={{padding:"10px 20px 0"}}><BackButton onBack={onBack} /></div>}
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <Boxes size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Memory</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">
              Long-term profile &amp; agent memory · synced to Obsidian
            </p>
          </div>
        </div>
        {phase === "ready" && <VaultSaveBadge status={status} />}
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
                  layoutId="memory-tab"
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
          <Spinner label="Loading memory…" />
        ) : phase === "error" ? (
          <ErrorState error={error} onRetry={() => void fetchData()} />
        ) : (
          <div className="space-y-3">
            {cards.length === 0 ? (
              <EmptyState
                icon={<Boxes size={26} />}
                title="No entries yet"
                detail="Add a card — it saves to the vault automatically."
              />
            ) : (
              cards.map((c) => (
                <div
                  key={c.id}
                  className="fade-in group rounded-2xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={c.title}
                      onChange={(e) => updateCard(c.id, { title: e.target.value })}
                      placeholder="Title"
                      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm font-medium text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-white/25"
                    />
                    <button
                      onClick={() => removeCard(c.id)}
                      aria-label="Delete entry"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-ink-faint)] transition hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea
                    value={c.content}
                    onChange={(e) => updateCard(c.id, { content: e.target.value })}
                    placeholder="Details…"
                    rows={2}
                    className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs leading-relaxed text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-white/25"
                  />
                </div>
              ))
            )}

            <button
              onClick={addCard}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3 text-xs text-[var(--color-ink-dim)] transition hover:border-white/30 hover:text-white"
            >
              <Plus size={15} /> Add {tab === "profile" ? "profile" : "memory"} entry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

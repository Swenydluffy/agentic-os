"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, StopCircle, Search, Sparkles, Paperclip, User } from "lucide-react";
import { AGENTS, getAgent, type AgentStatus } from "@/lib/agents";
import { AgentAvatar } from "./AgentAvatar";
import { MicButton, type MicHandle } from "./MicButton";
import { cn } from "@/lib/utils";
import { saveChatExchange } from "@/lib/vault-client";
import { useSpeechSynthesis, useAutoSpeak } from "@/lib/useSpeechSynthesis";
import { SpeakButton, AutoSpeakToggle } from "./SpeakButton";

type Msg = { id: string; role: "user" | "assistant"; content: string; ts: number };

const MIN = 60_000;

/** A few conversations arrive with an unread nudge so the rail feels alive. */
const NUDGES: Record<string, string> = {
  orchestrator:
    "Two threads are waiting on your call. Want me to prioritize the billing refactor before midnight?",
  security:
    "Heads up — I flagged anomalous token usage on /agent/scout. Want me to dig in?",
  ops: "Staging deploy is queued and green. Say the word and I'll ship it.",
};

function seedThreads(): Record<string, Msg[]> {
  const now = Date.now();
  const out: Record<string, Msg[]> = {};
  AGENTS.forEach((a, i) => {
    const thread: Msg[] = [
      {
        id: `${a.id}-greet`,
        role: "assistant",
        content: a.greeting,
        ts: now - (90 - i * 6) * MIN,
      },
    ];
    if (NUDGES[a.id]) {
      thread.push({
        id: `${a.id}-nudge`,
        role: "assistant",
        content: NUDGES[a.id],
        ts: now - (2 + i) * MIN,
      });
    }
    out[a.id] = thread;
  });
  return out;
}

/** reads[id] === messages the user has seen; everything beyond is unread. */
function seedReads(threads: Record<string, Msg[]>): Record<string, number> {
  const reads: Record<string, number> = {};
  for (const id of Object.keys(threads)) {
    reads[id] = NUDGES[id] ? threads[id].length - 1 : threads[id].length;
  }
  return reads;
}

function fmtClock(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtRail(ts: number) {
  const d = Math.max(0, Date.now() - ts);
  const m = Math.floor(d / MIN);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function startersFor(category: string): string[] {
  switch (category) {
    case "research":
      return ["What changed in the last 24h?", "Find sources on this topic", "Summarize the repo"];
    case "build":
      return ["Outline an implementation plan", "Review my latest diff", "Write tests for this module"];
    case "security":
      return ["Threat-model the auth flow", "Scan for exposed secrets", "Any risky dependencies?"];
    case "ops":
      return ["Show me the deploy plan", "Roll back the last release", "Status of the pipelines"];
    default:
      return ["What's the status of my fleet?", "Brief me on today", "What needs my decision?"];
  }
}

export function AgentChat({ initialAgentId }: { initialAgentId?: string | null }) {
  const [threads, setThreads] = useState<Record<string, Msg[]>>(seedThreads);
  const [reads, setReads] = useState<Record<string, number>>(() => seedReads(seedThreads()));
  const [activeId, setActiveId] = useState<string>(initialAgentId ?? AGENTS[0].id);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  const abortRefs = useRef<Record<string, AbortController>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const micRef = useRef<MicHandle>(null);

  const tts = useSpeechSynthesis();
  const [autoSpeak, setAutoSpeak] = useAutoSpeak();
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;

  const active = getAgent(activeId) ?? AGENTS[0];
  const activeThread = threads[activeId] ?? [];
  const isStreaming = !!streaming[activeId];

  // External selection (grid card / command palette) opens that conversation.
  useEffect(() => {
    if (initialAgentId) setActiveId(initialAgentId);
  }, [initialAgentId]);

  // Mark the open conversation as read.
  useEffect(() => {
    setReads((r) => ({ ...r, [activeId]: threads[activeId]?.length ?? 0 }));
  }, [activeId, threads]);

  // Keep the message view pinned to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeThread.length, activeThread[activeThread.length - 1]?.content, activeId]);

  // Grow the composer to fit its content — covers typing and live dictation alike.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const railAgents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return AGENTS.filter(
      (a) =>
        !needle ||
        a.name.toLowerCase().includes(needle) ||
        a.tagline.toLowerCase().includes(needle) ||
        a.description.toLowerCase().includes(needle)
    ).sort((a, b) => {
      const ta = threads[a.id]?.at(-1)?.ts ?? 0;
      const tb = threads[b.id]?.at(-1)?.ts ?? 0;
      return tb - ta;
    });
  }, [query, threads]);

  function unread(id: string) {
    return Math.max(0, (threads[id]?.length ?? 0) - (reads[id] ?? 0));
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    const agentId = activeId;
    const agent = getAgent(agentId);
    if (!content || streaming[agentId] || !agent) return;

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    // Drop any buffered speech state so a late onresult can't echo the just-sent
    // text back into the field.
    micRef.current?.reset();

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content, ts: Date.now() };
    const assistantId = crypto.randomUUID();
    const history = [...(threads[agentId] ?? []), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setThreads((t) => ({
      ...t,
      [agentId]: [
        ...(t[agentId] ?? []),
        userMsg,
        { id: assistantId, role: "assistant", content: "", ts: Date.now() },
      ],
    }));
    setStreaming((s) => ({ ...s, [agentId]: true }));

    const ac = new AbortController();
    abortRefs.current[agentId] = ac;

    let assistantText = "";
    let completed = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          agent: agentId,
          agentName: agent.name,
          system: agent.system,
          model: agent.model,
        }),
        signal: ac.signal,
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;
        setThreads((t) => ({
          ...t,
          [agentId]: (t[agentId] ?? []).map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          ),
        }));
      }
      completed = true;
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        const msg = e instanceof Error ? e.message : String(e);
        setThreads((t) => ({
          ...t,
          [agentId]: (t[agentId] ?? []).map((m) =>
            m.id === assistantId ? { ...m, content: m.content + `\n\n[error: ${msg}]` } : m
          ),
        }));
      }
    } finally {
      setStreaming((s) => ({ ...s, [agentId]: false }));
      delete abortRefs.current[agentId];

      // Persist the exchange to the Obsidian vault after it completes (covers
      // both a finished stream and a stopped-early one with partial content).
      if (assistantText.trim()) {
        saveChatExchange({
          agentName: agent.name,
          userMessage: content,
          assistantMessage: assistantText,
          timestamp: userMsg.ts,
        });
        // Auto-read the finished reply aloud when auto-speak is enabled.
        if (completed && autoSpeakRef.current) tts.speak(assistantId, assistantText);
      }
    }
  }

  function stop() {
    abortRefs.current[activeId]?.abort();
  }

  const headerStatus: AgentStatus = isStreaming ? "thinking" : "online";

  return (
    <div className="panel flex h-full overflow-hidden">
      {/* ── Conversation rail ───────────────────────────────── */}
      <aside className="hidden w-[300px] shrink-0 flex-col border-r border-white/5 bg-black/20 md:flex">
        <div className="border-b border-white/5 px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Agents</h2>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">
              <span className="pulse-dot" /> {AGENTS.length} online
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <Search size={14} className="text-[var(--color-ink-faint)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents…"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[var(--color-ink-faint)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {railAgents.map((a) => {
            const last = threads[a.id]?.at(-1);
            const isActive = a.id === activeId;
            const count = unread(a.id);
            const typing = !!streaming[a.id];
            return (
              <button
                key={a.id}
                onClick={() => setActiveId(a.id)}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition",
                  isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="rail-active"
                    className="absolute inset-0 rounded-xl border border-white/10"
                    style={{ boxShadow: `inset 0 0 22px ${a.gradient[0]}22` }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span
                  className="absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-r-full transition-all"
                  style={{
                    width: isActive ? 3 : 0,
                    background: a.gradient[0],
                    boxShadow: `0 0 10px ${a.gradient[0]}`,
                  }}
                />
                <AgentAvatar agent={a} size={42} status={typing ? "thinking" : "online"} active={isActive} />
                <span className="relative min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-display text-sm font-semibold text-white">
                      {a.name}
                    </span>
                    <span
                      suppressHydrationWarning
                      className="shrink-0 font-mono text-[10px] text-[var(--color-ink-faint)]"
                    >
                      {last ? fmtRail(last.ts) : ""}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-xs",
                        count > 0 ? "text-white/80" : "text-[var(--color-ink-dim)]"
                      )}
                    >
                      {typing ? (
                        <span style={{ color: a.gradient[0] }}>typing…</span>
                      ) : last?.role === "user" ? (
                        <span className="text-[var(--color-ink-faint)]">You: {last.content}</span>
                      ) : (
                        last?.content ?? a.tagline
                      )}
                    </span>
                    {count > 0 && (
                      <span
                        className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-[#070a13]"
                        style={{ background: a.gradient[0], boxShadow: `0 0 10px ${a.gradient[0]}88` }}
                      >
                        {count}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Active conversation ─────────────────────────────── */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-3.5 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <motion.span
              key={active.id}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            >
              <AgentAvatar agent={active} size={44} status={headerStatus} active />
            </motion.span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-semibold tracking-wide text-white">
                {active.name}
              </h2>
              <p className="truncate text-xs">
                {isStreaming ? (
                  <span style={{ color: active.gradient[0] }}>typing…</span>
                ) : (
                  <span className="text-[var(--color-ink-dim)]">
                    <span style={{ color: "var(--color-lime)" }}>● </span>
                    online · {active.tagline}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AutoSpeakToggle enabled={autoSpeak} onToggle={() => setAutoSpeak(!autoSpeak)} supported={tts.isSupported} />
            <span className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-dim)] sm:inline">
              {active.model}
            </span>
          </div>
        </header>

        {/* Mobile agent switcher */}
        <div className="flex gap-2 overflow-x-auto border-b border-white/5 px-3 py-2 md:hidden">
          {AGENTS.map((a) => (
            <button key={a.id} onClick={() => setActiveId(a.id)} className="shrink-0">
              <AgentAvatar
                agent={a}
                size={36}
                status={a.id === activeId ? "thinking" : undefined}
                active={a.id === activeId}
              />
            </button>
          ))}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mb-2 flex justify-center">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">
              Today
            </span>
          </div>

          <AnimatePresence initial={false}>
            {activeThread.map((m, i) => {
              const prev = activeThread[i - 1];
              const grouped = prev?.role === m.role && m.ts - prev.ts < 4 * MIN;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className={cn(
                    "flex items-end gap-2.5",
                    grouped ? "mt-1" : "mt-4",
                    m.role === "user" ? "flex-row-reverse" : ""
                  )}
                >
                  <span className="w-8 shrink-0">
                    {!grouped &&
                      (m.role === "assistant" ? (
                        <AgentAvatar agent={active} size={32} glow={false} />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-white/20 to-white/5 text-white">
                          <User size={16} />
                        </span>
                      ))}
                  </span>

                  <div
                    className={cn(
                      "flex max-w-[76%] flex-col gap-1",
                      m.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-lg",
                        m.role === "assistant"
                          ? "rounded-tl-md border border-white/10 bg-white/[0.04] text-[var(--color-ink)]"
                          : "rounded-tr-md text-white"
                      )}
                      style={
                        m.role === "user"
                          ? {
                              background: `linear-gradient(135deg, ${active.gradient[0]}, ${active.gradient[1]})`,
                              boxShadow: `0 8px 24px -10px ${active.gradient[0]}88`,
                            }
                          : undefined
                      }
                    >
                      {m.content ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <span className="flex items-center gap-1.5 py-0.5" style={{ color: active.gradient[0] }}>
                          <span className="typing-dot" />
                          <span className="typing-dot [animation-delay:160ms]" />
                          <span className="typing-dot [animation-delay:320ms]" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 px-1">
                      {m.role === "assistant" && m.content && (
                        <SpeakButton id={m.id} text={m.content} controller={tts} accent={active.gradient[0]} />
                      )}
                      {!grouped && (
                        <span
                          suppressHydrationWarning
                          className="font-mono text-[10px] text-[var(--color-ink-faint)]"
                        >
                          {m.content || m.role === "user" ? fmtClock(m.ts) : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Suggested starters when the thread is fresh */}
        {activeThread.length <= 1 && (
          <div className="flex flex-wrap gap-2 border-t border-white/5 px-4 py-3 sm:px-6">
            {startersFor(active.category).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[var(--color-ink-dim)] transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 border-t border-white/5 px-4 py-3 sm:px-6"
        >
          <button
            type="button"
            className="flex h-11 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white"
            aria-label="Attach"
          >
            <Paperclip size={16} />
          </button>
          <MicButton ref={micRef} value={input} onValueChange={setInput} />
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={`Message ${active.name}…`}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:bg-black/40"
              style={{ minHeight: 44, boxShadow: `0 0 0 0 ${active.gradient[0]}` }}
              onFocus={(e) =>
                (e.currentTarget.style.boxShadow = `0 0 0 1px ${active.gradient[0]}66, 0 0 22px -6px ${active.gradient[0]}66`)
              }
              onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            />
          </div>
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/20"
              aria-label="Stop"
            >
              <StopCircle size={18} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="group flex h-11 w-11 items-center justify-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${active.gradient[0]}, ${active.gradient[1]})` }}
              aria-label="Send"
            >
              <Send size={17} className="transition group-hover:translate-x-0.5" />
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

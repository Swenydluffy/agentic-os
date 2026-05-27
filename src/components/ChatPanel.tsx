"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, StopCircle, Bot, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MicButton } from "./MicButton";
import { getAgent } from "@/lib/agents";
import { saveChatExchange } from "@/lib/vault-client";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const STARTERS = [
  "What's the status of my fleet?",
  "Have the Architect outline a new module for billing.",
  "Summarize the last 24h of agent activity.",
  "Review the open PRs and pick the riskiest one.",
];

export function ChatPanel({ pinnedAgent }: { pinnedAgent?: string | null }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "boot",
      role: "assistant",
      content:
        "Bridge online. I'm Claude — your operator-in-residence. Ten agents are warm, telemetry is green. What are we doing today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content };
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;

    let assistantText = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          agent: pinnedAgent,
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
        setMessages((m) =>
          m.map((x) =>
            x.id === assistantId ? { ...x, content: x.content + chunk } : x
          )
        );
      }
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") {
        // graceful stop
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((m) =>
          m.map((x) =>
            x.id === assistantId
              ? { ...x, content: x.content + `\n\n[error: ${msg}]` }
              : x
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;

      // Persist the exchange to the Obsidian vault. The console is the "Bridge"
      // unless it's pinned to a specific agent, in which case use that name.
      if (assistantText.trim()) {
        const agentName = (pinnedAgent && getAgent(pinnedAgent)?.name) || "Bridge";
        saveChatExchange({
          agentName,
          userMessage: content,
          assistantMessage: assistantText,
        });
      }
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="panel relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[var(--color-cyan)] to-[var(--color-violet)] blur-[2px] opacity-80" />
            <div className="absolute inset-[2px] flex items-center justify-center rounded-md bg-[#04060d]">
              <Sparkles size={14} className="text-white" />
            </div>
          </div>
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-white">
              Claude Console
            </h2>
            <p className="text-[11px] text-[var(--color-ink-dim)]">
              {pinnedAgent ? (
                <>direct line · <span className="text-white">@{pinnedAgent}</span></>
              ) : (
                "all agents in scope · streaming"
              )}
            </p>
          </div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">
          model · sonnet 4.6
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                  m.role === "assistant"
                    ? "border-[var(--color-violet)]/30 bg-[var(--color-violet)]/10 text-[var(--color-violet)]"
                    : "border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]"
                }`}
              >
                {m.role === "assistant" ? <Bot size={13} /> : <User size={13} />}
              </div>
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "assistant"
                    ? "border border-white/10 bg-white/[0.03] text-[var(--color-ink)]"
                    : "bg-gradient-to-br from-[var(--color-cyan)]/15 to-[var(--color-violet)]/15 text-white"
                }`}
              >
                <p className="whitespace-pre-wrap">
                  {m.content || (
                    <span className="inline-flex items-center gap-1 text-[var(--color-ink-dim)]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
                    </span>
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 border-t border-white/5 px-5 py-3">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[var(--color-ink-dim)] transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-white/5 px-5 py-3"
      >
        <MicButton value={input} onValueChange={setInput} iconSize={16} />
        <div className="relative flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Talk to the bridge…"
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 pr-12 text-sm text-white placeholder:text-[var(--color-ink-faint)] outline-none transition focus:border-[var(--color-cyan)]/50 focus:bg-black/40"
            style={{ minHeight: 44, maxHeight: 180 }}
          />
        </div>
        {streaming ? (
          <button
            type="button"
            onClick={stop}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/20"
            aria-label="Stop"
          >
            <StopCircle size={16} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="group flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[var(--color-cyan)]/30 to-[var(--color-violet)]/30 text-white transition hover:from-[var(--color-cyan)]/50 hover:to-[var(--color-violet)]/50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send"
          >
            <Send size={15} className="transition group-hover:translate-x-0.5" />
          </button>
        )}
      </form>
    </div>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Send, StopCircle, Zap, User, AlertTriangle, PlugZap } from "lucide-react";
import { MicButton, type MicHandle } from "./MicButton";
import { saveChatExchange } from "@/lib/vault-client";
import { cn } from "@/lib/utils";
import { useSpeechSynthesis, useAutoSpeak } from "@/lib/useSpeechSynthesis";
import { SpeakButton, AutoSpeakToggle } from "./SpeakButton";

const CHAT_ENABLED = true;

type Msg = { id: string; role: "user" | "assistant" | "error"; content: string };
type Channel = "mc" | "telegram";

type Status =
  | { state: "checking" }
  | { state: "live"; version?: string; gateway?: string }
  | { state: "offline"; error: string };

interface StatusResponse {
  ok: boolean; online?: boolean; version?: string; gateway?: string; error?: string;
}

// ── Telegram recent context (read-only view of shared conversation) ───────────
type TelegramEntry = { role: string; text: string; ts: string };

async function fetchTelegramContext(): Promise<TelegramEntry[]> {
  try {
    const r = await fetch("/api/brad-context");
    if (!r.ok) return [];
    const text = await r.text();
    // Parse the brad-context briefing into readable lines
    const lines = text.split("\n").filter(l => l.trim());
    return lines.slice(0, 40).map((l, i) => ({ role: "context", text: l, ts: String(i) }));
  } catch {
    return [];
  }
}

const HERMES = "Hermes";
const GRADIENT: [string, string] = ["#ffb547", "#ff6a3d"];

export function HermesPanel() {
  const [channel, setChannel] = useState<Channel>("mc");
  const [messages, setMessages] = useState<Msg[]>([{
    id: "boot",
    role: "assistant",
    content: "Hermes online channel. Messages here route to the live Hermes Agent server (via its REST API) — not the Claude API.",
  }]);
  const [tgContext, setTgContext]     = useState<TelegramEntry[]>([]);
  const [tgLoading, setTgLoading]     = useState(false);
  const [status, setStatus]           = useState<Status>({ state: "checking" });
  const [input, setInput]             = useState("");
  const [streaming, setStreaming]     = useState(false);
  const abortRef  = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const micRef    = useRef<MicHandle>(null);

  const tts = useSpeechSynthesis();
  const [autoSpeak, setAutoSpeak] = useAutoSpeak();
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;

  // ── Poll connection status ──
  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const res = await fetch("/api/hermes");
        const data = (await res.json()) as StatusResponse;
        if (!active) return;
        if (data.online) setStatus({ state: "live", version: data.version, gateway: data.gateway });
        else setStatus({ state: "offline", error: data.error ?? "unreachable" });
      } catch (e) {
        if (active) setStatus({ state: "offline", error: e instanceof Error ? e.message : String(e) });
      }
    }
    void check();
    const interval = setInterval(check, 15_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // ── Auto-scroll messages ──
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, tgContext]);

  // ── Load Telegram context when switching to that view ──
  useEffect(() => {
    if (channel !== "telegram") return;
    setTgLoading(true);
    fetchTelegramContext().then(entries => {
      setTgContext(entries);
      setTgLoading(false);
    });
  }, [channel]);

  // ── Send message (UNCHANGED — same plumbing as before) ──
  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setInput("");
    micRef.current?.reset();

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content };
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);
    setStreaming(true);

    const ac = new AbortController();
    abortRef.current = ac;
    let assistantText = "";

    try {
      const res = await fetch("/api/hermes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
        signal: ac.signal,
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; reply?: string; error?: string }
        | null;

      if (res.ok && data?.ok && typeof data.reply === "string") {
        assistantText = data.reply;
        const reply = data.reply;
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: reply } : x)));
        if (autoSpeakRef.current) tts.speak(assistantId, reply);
      } else {
        const errText = data?.error ?? `Hermes request failed (HTTP ${res.status})`;
        setMessages((m) =>
          m.map((x) => (x.id === assistantId ? { ...x, role: "error", content: errText } : x)),
        );
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((m) =>
          m.map((x) => (x.id === assistantId ? { ...x, role: "error", content: `Connection error: ${msg}` } : x)),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (assistantText.trim()) {
        saveChatExchange({ agentName: HERMES, userMessage: content, assistantMessage: assistantText });
      }
    }
  }

  function stop() { abortRef.current?.abort(); }

  const offline = status.state === "offline";

  return (
    // Removed max-w-3xl and mx-auto — fills container width cleanly
    <div className="panel flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1a1206] shrink-0"
            style={{ background: `linear-gradient(135deg, ${GRADIENT[0]}, ${GRADIENT[1]})` }}
          >
            <Zap size={16} />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-white">Hermes</h2>
            <p className="text-[11px] text-[var(--color-ink-dim)]">Live agent · full tool access</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ── Channel toggle — view only, shared Obsidian memory underneath ── */}
          <div className="flex items-center rounded-lg border border-white/10 overflow-hidden" style={{ background: "#0d1117" }}>
            <button
              onClick={() => setChannel("mc")}
              className={cn(
                "px-3 py-1.5 text-[11px] font-semibold transition",
                channel === "mc"
                  ? "text-[#ffb547]"
                  : "text-[var(--color-ink-dim)] hover:text-white"
              )}
              style={channel === "mc" ? { background: "rgba(255,181,71,0.12)" } : {}}
              title="Mission Control chat"
            >
              MC
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={() => setChannel("telegram")}
              className={cn(
                "px-3 py-1.5 text-[11px] font-semibold transition",
                channel === "telegram"
                  ? "text-[#60a5fa]"
                  : "text-[var(--color-ink-dim)] hover:text-white"
              )}
              style={channel === "telegram" ? { background: "rgba(96,165,250,0.12)" } : {}}
              title="Telegram conversation view"
            >
              TG
            </button>
          </div>

          <AutoSpeakToggle enabled={autoSpeak} onToggle={() => setAutoSpeak(!autoSpeak)} supported={tts.isSupported} />
          <StatusPill status={status} />
        </div>
      </header>

      {offline && (
        <div className="flex items-center gap-2 border-b border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-2 text-xs text-[var(--color-danger)]">
          <AlertTriangle size={13} />
          Hermes is offline ({status.error}).
        </div>
      )}

      {/* ── TELEGRAM VIEW — read-only shared context ── */}
      {channel === "telegram" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2 text-[11px] text-[var(--color-ink-dim)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
            Shared Obsidian memory — same conversation Brad uses on Telegram
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {tgLoading ? (
              <div className="flex items-center gap-2 text-[var(--color-ink-dim)] text-xs py-4">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                Loading shared context…
              </div>
            ) : tgContext.length === 0 ? (
              <div className="text-[var(--color-ink-dim)] text-xs py-4">No context available yet.</div>
            ) : (
              tgContext.map((e, i) => (
                <div key={i} className="text-[11px] text-[var(--color-ink-dim)] leading-relaxed py-0.5 border-b border-white/[0.02]">
                  {e.text}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-white/5 px-4 py-2 text-[10px] text-[var(--color-ink-faint)]">
            Switch to MC to send a message →
          </div>
        </div>
      )}

      {/* ── MC CHAT VIEW ── */}
      {channel === "mc" && (
        CHAT_ENABLED ? (
          <>
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "")}
                  >
                    <div className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                      m.role === "user"
                        ? "border-white/15 bg-white/10 text-white"
                        : m.role === "error"
                          ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                          : "border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 text-[var(--color-amber)]",
                    )}>
                      {m.role === "user" ? <User size={13} /> : m.role === "error" ? <AlertTriangle size={13} /> : <Zap size={13} />}
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        m.role === "user"
                          ? "text-white"
                          : m.role === "error"
                            ? "border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                            : "border border-white/10 bg-white/[0.03] text-[var(--color-ink)]",
                      )}
                      style={m.role === "user"
                        ? { background: `linear-gradient(135deg, ${GRADIENT[0]}, ${GRADIENT[1]})` }
                        : undefined}
                    >
                      {m.content ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--color-ink-dim)]">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
                        </span>
                      )}
                    </div>
                    {m.role === "assistant" && m.content && (
                      <div className="flex items-end pb-0.5">
                        <SpeakButton id={m.id} text={m.content} controller={tts} accent="var(--color-amber)" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex items-end gap-2 border-t border-white/5 px-4 py-3"
            >
              <MicButton ref={micRef} value={input} onValueChange={setInput} iconSize={16} />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                rows={1}
                placeholder={offline ? "Hermes is offline…" : "Message Hermes…"}
                className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-amber)]/50 focus:bg-black/40"
              />
              {streaming ? (
                <button type="button" onClick={stop} aria-label="Stop"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/20">
                  <StopCircle size={16} />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} aria-label="Send"
                  className="group flex h-11 w-11 items-center justify-center rounded-xl text-[#1a1206] transition disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${GRADIENT[0]}, ${GRADIENT[1]})` }}>
                  <Send size={15} className="transition group-hover:translate-x-0.5" />
                </button>
              )}
            </form>
          </>
        ) : (
          <StatusOnlyBody status={status} />
        )
      )}
    </div>
  );
}

function StatusOnlyBody({ status }: { status: Status }) {
  const live = status.state === "live";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl border",
        live ? "border-[var(--color-lime)]/40 bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
              : "border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)]")}>
        <PlugZap size={26} />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-white">
          {status.state === "checking" ? "Checking Hermes…" : live ? "Connected to Hermes" : "Hermes unreachable"}
        </p>
        <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
          {live
            ? `Live${status.version ? ` · v${status.version}` : ""}${status.gateway ? ` · gateway ${status.gateway}` : ""}`
            : status.state === "offline" ? status.error : "Pinging /api/status…"}
        </p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map = {
    checking: { label: "CHECKING", color: "var(--color-cyan)" },
    live:     { label: "LIVE",     color: "var(--color-lime)" },
    offline:  { label: "OFFLINE",  color: "var(--color-danger)" },
  } as const;
  const { label, color } = map[status.state];
  const detail =
    status.state === "live"    ? (status.version ? `v${status.version}` : "") :
    status.state === "offline" ? status.error : "";
  return (
    <span
      className="flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]"
      style={{ borderColor: `${color}55`, color }}
      title={detail}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", status.state === "live" && "animate-pulse")}
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {label}
    </span>
  );
}

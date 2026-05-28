"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Send, StopCircle, Zap, User, AlertTriangle, PlugZap } from "lucide-react";
import { MicButton } from "./MicButton";
import { saveChatExchange } from "@/lib/vault-client";
import { cn } from "@/lib/utils";
import { useSpeechSynthesis, useAutoSpeak } from "@/lib/useSpeechSynthesis";
import { SpeakButton, AutoSpeakToggle } from "./SpeakButton";

/**
 * Master switch for the Hermes chat composer. Left OFF for now — the panel shows
 * live connection status only, pending a decision on the chat/auth approach.
 *
 * The backend (`/api/hermes` POST -> src/lib/hermes.ts) is implemented and
 * working via Hermes' authenticated REST API (no WebSocket). Flip this to `true`
 * to turn the chat back on — no other changes needed.
 */
const CHAT_ENABLED = true;

type Msg = { id: string; role: "user" | "assistant" | "error"; content: string };

type Status =
  | { state: "checking" }
  | { state: "live"; version?: string; gateway?: string }
  | { state: "offline"; error: string };

interface StatusResponse {
  ok: boolean;
  online?: boolean;
  version?: string;
  gateway?: string;
  error?: string;
}

const HERMES = "Hermes";
const GRADIENT: [string, string] = ["#ffb547", "#ff6a3d"]; // distinct amber/ember identity

export function HermesPanel() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "boot",
      role: "assistant",
      content:
        "Hermes online channel. Messages here route to the live Hermes Agent server (via its REST API) — not the Claude API.",
    },
  ]);
  const [status, setStatus] = useState<Status>({ state: "checking" });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tts = useSpeechSynthesis();
  const [autoSpeak, setAutoSpeak] = useAutoSpeak();
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;

  // Poll real connection status.
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
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
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

  function stop() {
    abortRef.current?.abort();
  }

  const offline = status.state === "offline";

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      {/* Header with live status */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[#1a1206]"
            style={{ background: `linear-gradient(135deg, ${GRADIENT[0]}, ${GRADIENT[1]})` }}
          >
            <Zap size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Hermes</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">Live external agent · full tool access</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AutoSpeakToggle enabled={autoSpeak} onToggle={() => setAutoSpeak(!autoSpeak)} supported={tts.isSupported} />
          <StatusPill status={status} />
        </div>
      </header>

      {offline && (
        <div className="flex items-center gap-2 border-b border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-5 py-2.5 text-xs text-[var(--color-danger)]">
          <AlertTriangle size={14} />
          Hermes is offline ({status.error}).
        </div>
      )}

      {CHAT_ENABLED ? (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
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
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                      m.role === "user"
                        ? "border-white/15 bg-white/10 text-white"
                        : m.role === "error"
                          ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                          : "border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 text-[var(--color-amber)]",
                    )}
                  >
                    {m.role === "user" ? <User size={13} /> : m.role === "error" ? <AlertTriangle size={13} /> : <Zap size={13} />}
                  </div>
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      m.role === "user"
                        ? "text-white"
                        : m.role === "error"
                          ? "border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                          : "border border-white/10 bg-white/[0.03] text-[var(--color-ink)]",
                    )}
                    style={
                      m.role === "user"
                        ? { background: `linear-gradient(135deg, ${GRADIENT[0]}, ${GRADIENT[1]})` }
                        : undefined
                    }
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

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 border-t border-white/5 px-5 py-3"
          >
            <MicButton value={input} onValueChange={setInput} iconSize={16} />
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
              placeholder={offline ? "Hermes is offline…" : "Message Hermes…"}
              className="max-h-[160px] min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-amber)]/50 focus:bg-black/40"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/20"
              >
                <StopCircle size={16} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send"
                className="group flex h-11 w-11 items-center justify-center rounded-xl text-[#1a1206] transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${GRADIENT[0]}, ${GRADIENT[1]})` }}
              >
                <Send size={15} className="transition group-hover:translate-x-0.5" />
              </button>
            )}
          </form>
        </>
      ) : (
        <StatusOnlyBody status={status} />
      )}
    </div>
  );
}

/** Shown while chat is paused — connection status only. */
function StatusOnlyBody({ status }: { status: Status }) {
  const live = status.state === "live";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <span
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl border",
          live
            ? "border-[var(--color-lime)]/40 bg-[var(--color-lime)]/10 text-[var(--color-lime)]"
            : "border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)]",
        )}
      >
        <PlugZap size={26} />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-white">
          {status.state === "checking"
            ? "Checking Hermes…"
            : live
              ? "Connected to Hermes"
              : "Hermes unreachable"}
        </p>
        <p className="mt-1 text-sm text-[var(--color-ink-dim)]">
          {live
            ? `Live${status.version ? ` · v${status.version}` : ""}${status.gateway ? ` · gateway ${status.gateway}` : ""}`
            : status.state === "offline"
              ? status.error
              : "Pinging /api/status…"}
        </p>
      </div>
      <p className="max-w-sm text-xs text-[var(--color-ink-faint)]">
        Chat is paused while we settle the connection approach. Status above is a real ping of the Hermes server.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map = {
    checking: { label: "CHECKING", color: "var(--color-cyan)" },
    live: { label: "LIVE", color: "var(--color-lime)" },
    offline: { label: "OFFLINE", color: "var(--color-danger)" },
  } as const;
  const { label, color } = map[status.state];
  const detail =
    status.state === "live"
      ? status.version
        ? `v${status.version}`
        : ""
      : status.state === "offline"
        ? status.error
        : "";
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

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Send, StopCircle, Zap, User, AlertTriangle, Copy, Check, RotateCcw } from "lucide-react";
import { MicButton, type MicHandle } from "./MicButton";
import { AttachMenu } from "./AttachMenu";
import { saveChatExchange } from "@/lib/vault-client";
import { cn } from "@/lib/utils";
import { useSpeechSynthesis, useAutoSpeak } from "@/lib/useSpeechSynthesis";
import { SpeakButton, AutoSpeakToggle } from "./SpeakButton";

type Msg = { id: string; role: "user" | "assistant" | "error"; content: string };

type Status =
  | { state: "checking" }
  | { state: "live"; version?: string; gateway?: string }
  | { state: "offline"; error: string };

interface StatusResponse {
  ok: boolean; online?: boolean; version?: string; gateway?: string; error?: string;
}

const GRADIENT: [string, string] = ["#ffb547", "#ff6a3d"];
const AGENT_NAME = "Hermes-MC";
const BOOT_MSG = "Hermes MC thread. Use this for side questions and tasks — keeps your main Telegram thread clean.";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      title="Copy message"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 24, height: 24, borderRadius: 5,
        border: "1px solid rgba(255,255,255,0.1)",
        background: copied ? "rgba(96,165,250,0.12)" : "rgba(0,0,0,0.25)",
        color: copied ? "#60a5fa" : "#6b7280",
        cursor: "pointer", flexShrink: 0, transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = "#d1d5db"; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = "#6b7280"; }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

export function HermesMCPanel() {
  const [messages, setMessages] = useState<Msg[]>([{
    id: "boot", role: "assistant", content: BOOT_MSG,
  }]);
  const [status, setStatus]         = useState<Status>({ state: "checking" });
  const [input, setInput]           = useState("");
  const [streaming, setStreaming]   = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const micRef    = useRef<MicHandle>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const dropRef   = useRef<HTMLDivElement>(null);
  const [pendingImgs, setPendingImgs] = useState<string[]>([]);

  const tts = useSpeechSynthesis();
  const [autoSpeak, setAutoSpeak] = useAutoSpeak();
  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function clearConversation() {
    setMessages([{ id: "boot", role: "assistant", content: BOOT_MSG }]);
    setInput("");
    abortRef.current?.abort();
  }

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
      const res = await fetch("/api/hermes-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const errText = "Hermes request failed (HTTP " + res.status + ")";
        setMessages((m) =>
          m.map((x) => (x.id === assistantId ? { ...x, role: "error", content: errText } : x)),
        );
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            const data = JSON.parse(json) as { ok?: boolean; reply?: string; error?: string };
            if (data.ok && typeof data.reply === "string") {
              assistantText = data.reply;
              setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: data.reply! } : x)));
              if (autoSpeakRef.current) tts.speak(assistantId, data.reply);
            } else if (!data.ok) {
              const errText = data.error ?? "Hermes error";
              setMessages((m) =>
                m.map((x) => (x.id === assistantId ? { ...x, role: "error", content: errText } : x)),
              );
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((m) =>
          m.map((x) => (x.id === assistantId ? { ...x, role: "error", content: "Connection error: " + msg } : x)),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (assistantText.trim()) {
        saveChatExchange({ agentName: AGENT_NAME, userMessage: content, assistantMessage: assistantText });
      }
    }
  }

  function stop() { abortRef.current?.abort(); }

  function handleFile() { fileRef.current?.click(); }
  async function handlePaste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith("image/"));
        if (imgType) {
          const blob = await item.getType(imgType);
          const url  = await blobToDataURL(blob);
          setPendingImgs(p => [...p, url]);
          return;
        }
      }
    } catch { /* permission denied — fall through */ }
  }
  function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  function attachFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(f => {
      if (!f.type.startsWith("image/")) return;
      const r = new FileReader();
      r.onload = () => setPendingImgs(p => [...p, r.result as string]);
      r.readAsDataURL(f);
    });
  }
  function handleTextareaPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = e.clipboardData?.files;
    if (files && files.length > 0 && files[0].type.startsWith("image/")) {
      e.preventDefault();
      attachFiles(files);
    }
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation();
    dropRef.current?.classList.remove("ring-2", "ring-[#f59e0b]");
    attachFiles(e.dataTransfer.files);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    dropRef.current?.classList.add("ring-2", "ring-[#f59e0b]");
  }
  function handleDragLeave() {
    dropRef.current?.classList.remove("ring-2", "ring-[#f59e0b]");
  }
  function handleSearch() {
    setInput(prev => prev ? prev + " [web search] " : "/search ");
  }

  const offline = status.state === "offline";

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <input ref={fileRef} type="file" multiple accept="image/*,*" style={{ display: "none" }} />

      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1a1206] shrink-0"
            style={{ background: `linear-gradient(135deg, ${GRADIENT[0]}, ${GRADIENT[1]})` }}
          >
            <Zap size={16} />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-white">Hermes — MC</h2>
            <p className="text-[11px] text-[var(--color-ink-dim)]">Side thread · tasks &amp; questions</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearConversation}
            title="New conversation"
            className="flex items-center justify-center rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[11px] text-[var(--color-ink-dim)] transition hover:border-white/20 hover:text-white"
          >
            <RotateCcw size={11} className="mr-1" /> New
          </button>
          <AutoSpeakToggle enabled={autoSpeak} onToggle={() => setAutoSpeak(!autoSpeak)} supported={tts.isSupported} />
          <StatusPill status={status} />
        </div>
      </header>

      {offline && (
        <div className="flex items-center gap-2 border-b border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-2 text-xs text-[var(--color-danger)]">
          <AlertTriangle size={13} />
          Hermes is offline ({status.state === "offline" ? status.error : ""}).
        </div>
      )}

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
              onMouseEnter={() => setHoveredMsg(m.id)}
              onMouseLeave={() => setHoveredMsg(null)}
            >
              <div className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                m.role === "user"
                  ? "border-white/15 bg-white/10 text-white"
                  : m.role === "error"
                    ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                    : "border-[#ffb547]/40 bg-[#ffb547]/10 text-[#ffb547]",
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
              {m.content && (hoveredMsg === m.id || tts.speakingId === m.id) && (
                <div className={cn("flex items-end gap-1 pb-0.5", m.role === "user" ? "flex-row-reverse" : "")}>
                  <CopyButton text={m.content} />
                  {m.role === "assistant" && (
                    <SpeakButton id={m.id} text={m.content} controller={tts} accent="var(--color-amber)" />
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="border-t border-white/5 rounded-b-xl transition"
      >
        {pendingImgs.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {pendingImgs.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} alt="attachment" className="h-16 w-16 rounded-lg object-cover border border-white/10" />
                <button type="button" onClick={() => setPendingImgs(p => p.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-white text-[9px] leading-none">×</button>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-end gap-2 px-4 py-3"
        >
        <AttachMenu accent="#ffb547" onFile={handleFile} onPaste={handlePaste} onSearch={handleSearch} />
        <MicButton ref={micRef} value={input} onValueChange={setInput} iconSize={16} />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          onPaste={handleTextareaPaste}
          rows={1}
          placeholder={offline ? "Hermes is offline…" : "Message Hermes (side thread)…"}
          className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-[#ffb547]/50 focus:bg-black/40"
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

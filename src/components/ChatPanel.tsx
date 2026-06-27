"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, StopCircle, Bot, User, Zap, Copy, Check, RotateCcw, ChevronDown } from "lucide-react";
import { WorkerDispatch } from "./WorkerDispatch";
import { AttachMenu } from "./AttachMenu";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { MicButton, type MicHandle } from "./MicButton";
import { getAgent } from "@/lib/agents";
import { saveChatExchange } from "@/lib/vault-client";
import { useSpeechSynthesis, useAutoSpeak } from "@/lib/useSpeechSynthesis";
import { SpeakButton, AutoSpeakToggle } from "./SpeakButton";

// ── AI Console LIVE/OFFLINE — pings /api/hermes every 15s ───────────────────
function useConsoleReady() {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    async function ping() {
      try { const r = await fetch("/api/hermes"); if (mounted) setLive(r.ok); }
      catch { if (mounted) setLive(false); }
    }
    void ping();
    const iv = setInterval(ping, 15_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);
  return live;
}

type Msg = { id: string; role: "user" | "assistant"; content: string };

const BOOT_MSG = "Bridge online. I'm your AI Console — top-tier reasoning, full-stack access. Ten agents are warm, telemetry is green. What are we doing today?";

// ── Top-tier console models ────────────────────────────────────────────────────
const CONSOLE_MODELS = [
  { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", shortName: "Sonnet 4.6", color: "#a78bfa" },
  { id: "anthropic/claude-opus-4.8",   label: "Claude Opus 4.8",   shortName: "Opus 4.8",   color: "#c084fc" },
  { id: "openai/gpt-5.5",              label: "GPT-5.5",            shortName: "GPT-5.5",    color: "#34d399" },
  { id: "openai/gpt-5.5-pro",          label: "GPT-5.5 Pro",        shortName: "GPT-5.5 Pro",color: "#10b981" },
  { id: "google/gemini-3.1-pro-preview",label:"Gemini 3.1 Pro",    shortName: "Gemini 3.1", color: "#60a5fa" },
  { id: "x-ai/grok-4.3",               label: "Grok 4.3",           shortName: "Grok 4.3",   color: "#fb923c" },
  { id: "deepseek/deepseek-v4-pro",    label: "DeepSeek V4 Pro",    shortName: "DS V4 Pro",  color: "#38bdf8" },
] as const;

const DEFAULT_CONSOLE_MODEL = CONSOLE_MODELS[0];

// ── CopyButton — appears on hover ─────────────────────────────────────────────
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

// ── Model selector dropdown ────────────────────────────────────────────────────
function ConsoleModelSelector({
  selected, onChange,
}: {
  selected: typeof CONSOLE_MODELS[number];
  onChange: (m: typeof CONSOLE_MODELS[number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.30)",
          color: "#e5e7eb", fontSize: 11, fontWeight: 600,
          cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
        title={selected.label}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
          background: selected.color,
          boxShadow: `0 0 6px ${selected.color}`,
        }} />
        <span style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
          {selected.shortName}
        </span>
        <ChevronDown size={10} style={{ opacity: 0.6, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 999,
          background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: 4, minWidth: 190,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}>
          {/* Header label */}
          <div style={{ padding: "4px 10px 6px", fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "#4b5563", textTransform: "uppercase" }}>
            AI Console — Top Tier
          </div>
          {CONSOLE_MODELS.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onChange(m); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "7px 10px", borderRadius: 7, border: "none",
                background: m.id === selected.id ? "rgba(255,255,255,0.07)" : "transparent",
                color: m.id === selected.id ? "#ffffff" : "#9ca3af",
                fontSize: 12, fontWeight: m.id === selected.id ? 600 : 400,
                cursor: "pointer", textAlign: "left", transition: "background 0.1s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#ffffff"; }}
              onMouseLeave={e => {
                e.currentTarget.style.background = m.id === selected.id ? "rgba(255,255,255,0.07)" : "transparent";
                e.currentTarget.style.color = m.id === selected.id ? "#ffffff" : "#9ca3af";
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: m.color, opacity: m.id === selected.id ? 1 : 0.5,
              }} />
              {m.label}
              {m.id === selected.id && (
                <span style={{ marginLeft: "auto", fontSize: 9, color: m.color, fontWeight: 700 }}>ACTIVE</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({ pinnedAgent }: { pinnedAgent?: string | null }) {
  const [activeTab, setActiveTab] = useState<"chat" | "dispatch">("chat");
  const [messages, setMessages]   = useState<Msg[]>([{
    id: "boot", role: "assistant", content: BOOT_MSG,
  }]);
  const [input, setInput]         = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const consoleLive = useConsoleReady();

  // ── Console-local model (independent of global Model Router) ────────────────
  const [consoleModel, setConsoleModel] = useState<typeof CONSOLE_MODELS[number]>(DEFAULT_CONSOLE_MODEL);
  const consoleModelRef = useRef(consoleModel);
  consoleModelRef.current = consoleModel;

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
    let completed = false;

    // Always route through OpenRouter with the full model ID (e.g. "x-ai/grok-4.3")
    // The /api/chat route handles the OpenRouter fast-path when provider="openrouter"
    const provider = "openrouter";
    const model    = consoleModelRef.current.id;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          agent: pinnedAgent,
          provider,
          model,
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
        setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, content: x.content + chunk } : x));
      }
      completed = true;
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((m) => m.map((x) => x.id === assistantId ? { ...x, content: x.content + `\n\n[error: ${msg}]` } : x));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (assistantText.trim()) {
        const agentName = (pinnedAgent && getAgent(pinnedAgent)?.name) || "AI Console";
        saveChatExchange({ agentName, userMessage: content, assistantMessage: assistantText });
        if (completed && autoSpeakRef.current) tts.speak(assistantId, assistantText);
      }
    }
  }

  function stop() { abortRef.current?.abort(); }

  // ── Attach handlers ──────────────────────────────────────────────────────────
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
    } catch { /* permission denied or no image — fall through */ }
    document.getElementById("ai-console-textarea")?.focus();
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
    dropRef.current?.classList.remove("ring-2", "ring-[var(--color-cyan)]");
    attachFiles(e.dataTransfer.files);
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    dropRef.current?.classList.add("ring-2", "ring-[var(--color-cyan)]");
  }
  function handleDragLeave() {
    dropRef.current?.classList.remove("ring-2", "ring-[var(--color-cyan)]");
  }
  function handleSearch() {
    setInput(prev => (prev ? prev + " [web search] " : "/search "));
    document.getElementById("ai-console-textarea")?.focus();
  }

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <input ref={fileRef} type="file" multiple accept="image/*,*" style={{ display: "none" }} />

      {/* Header — identical structure to Hermes panels: left=icon+title, right=[AutoSpeak]+[LIVE] */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white shrink-0"
            style={{ background: "linear-gradient(135deg, var(--color-cyan), var(--color-violet))" }}
          >
            <Sparkles size={16} />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-wide text-white whitespace-nowrap">AI Console</h2>
            <p className="text-[11px] text-[var(--color-ink-dim)]">
              {pinnedAgent ? <>direct line · <span className="text-white">@{pinnedAgent}</span></> : "all agents in scope · streaming"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AutoSpeakToggle enabled={autoSpeak} onToggle={() => setAutoSpeak(!autoSpeak)} supported={tts.isSupported} />
          <ConsoleLivePill live={consoleLive} />
        </div>
      </header>

      {/* Sub-toolbar: model selector + tabs + clear — below header, above content */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-1.5 shrink-0">
        {/* Console model selector */}
        <ConsoleModelSelector selected={consoleModel} onChange={(m) => {
          setConsoleModel(m);
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `[Console switched to **${m.label}**]`,
          }]);
        }} />
        <div className="flex-1" />
        {/* Tab toggle */}
        <div className="flex rounded-lg border border-white/10 bg-black/20 p-0.5">
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition",
              activeTab === "chat" ? "bg-white/10 text-white" : "text-[var(--color-ink-dim)] hover:text-white"
            )}
          >
            <Sparkles size={11} /> Chat
          </button>
          <button
            onClick={() => setActiveTab("dispatch")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition",
              activeTab === "dispatch" ? "bg-white/10 text-white" : "text-[var(--color-ink-dim)] hover:text-white"
            )}
          >
            <Zap size={11} /> Dispatch
          </button>
        </div>
        {/* Clear */}
        <button
          type="button"
          onClick={clearConversation}
          title="New conversation"
          className="flex items-center justify-center rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-[var(--color-ink-dim)] transition hover:border-white/20 hover:text-white"
        >
          <RotateCcw size={11} className="mr-1" /> New
        </button>
      </div>

      {/* Dispatch tab */}
      {activeTab === "dispatch" && <WorkerDispatch />}

      {/* Chat tab */}
      {activeTab === "chat" && (
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
                  className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                  onMouseEnter={() => setHoveredMsg(m.id)}
                  onMouseLeave={() => setHoveredMsg(null)}
                >
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                    m.role === "assistant"
                      ? "border-[var(--color-violet)]/30 bg-[var(--color-violet)]/10 text-[var(--color-violet)]"
                      : "border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]"
                  }`}>
                    {m.role === "assistant" ? <Bot size={13} /> : <User size={13} />}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "assistant"
                      ? "border border-white/10 bg-white/[0.03] text-[var(--color-ink)]"
                      : "bg-gradient-to-br from-[var(--color-cyan)]/15 to-[var(--color-violet)]/15 text-white"
                  }`}>
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
                  {/* Copy + speak on hover */}
                  {m.content && hoveredMsg === m.id && (
                    <div className={`flex items-end gap-1 pb-0.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                      <CopyButton text={m.content} />
                      {m.role === "assistant" && (
                        <SpeakButton id={m.id} text={m.content} controller={tts} accent="var(--color-violet)" />
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
            <AttachMenu accent="var(--color-cyan)" onFile={handleFile} onPaste={handlePaste} onSearch={handleSearch} />
            <MicButton ref={micRef} value={input} onValueChange={setInput} iconSize={16} />
            <div className="relative flex-1">
              <textarea
                id="ai-console-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                onPaste={handleTextareaPaste}
                rows={1}
                placeholder="Talk to the bridge…"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-[var(--color-ink-faint)] outline-none transition focus:border-[var(--color-cyan)]/50 focus:bg-black/40"
                style={{ minHeight: 44, maxHeight: 180 }}
              />
            </div>
            {streaming ? (
              <button type="button" onClick={stop}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/20"
                aria-label="Stop">
                <StopCircle size={16} />
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()}
                className="group flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[var(--color-cyan)]/30 to-[var(--color-violet)]/30 text-white transition hover:from-[var(--color-cyan)]/50 hover:to-[var(--color-violet)]/50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send">
                <Send size={15} className="transition group-hover:translate-x-0.5" />
              </button>
            )}
          </form>
          </div>
        </>
      )}
    </div>
  );
}

// ── ConsoleLivePill — identical to Hermes panel StatusPill ───────────────────
function ConsoleLivePill({ live }: { live: boolean | null }) {
  const state = live === null ? "checking" : live ? "live" : "offline";
  const map = {
    checking: { label: "CHECKING", color: "var(--color-cyan)" },
    live:     { label: "LIVE",     color: "var(--color-lime)" },
    offline:  { label: "OFFLINE",  color: "var(--color-danger)" },
  } as const;
  const { label, color } = map[state];
  return (
    <span
      className="flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]"
      style={{ borderColor: `${color}55`, color }}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", state === "live" && "animate-pulse")}
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {label}
    </span>
  );
}

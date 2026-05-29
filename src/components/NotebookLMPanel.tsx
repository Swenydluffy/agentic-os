"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Notebook,
  Library,
  MessageSquare,
  Layers,
  AudioLines,
  RefreshCw,
  Send,
  Check,
  AlertTriangle,
  FileText,
  Bot,
  User,
} from "lucide-react";
import {
  normalizeNotebooks,
  normalizeSources,
  normalizeArtifacts,
  extractAnswer,
  type NotebookView,
  type SourceView,
  type ArtifactView,
} from "@/lib/notebooklm-view";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

const ACCENT = "#60a5fa";

type TabId = "library" | "chat" | "studio" | "assets";

const TABS: { id: TabId; label: string; icon: typeof Library }[] = [
  { id: "library", label: "Library", icon: Library },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "studio", label: "Studio", icon: Layers },
  { id: "assets", label: "Assets", icon: AudioLines },
];

type NlmResponse = { ok: true; data: unknown } | { ok: false; error: string };

async function callNlm(payload: {
  action: "list" | "sources" | "artifacts" | "chat";
  notebook?: string;
  question?: string;
}): Promise<NlmResponse> {
  try {
    const res = await fetch("/api/notebooklm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as NlmResponse;
    return data;
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type Load<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; items: T[] }
  | { state: "error"; error: string };

type ChatMsg = { id: string; role: "user" | "assistant"; content: string; pending?: boolean };

export function NotebookLMPanel() {
  const [tab, setTab] = useState<TabId>("library");
  const [notebooks, setNotebooks] = useState<Load<NotebookView>>({ state: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [sources, setSources] = useState<Load<SourceView>>({ state: "idle" });
  const [assets, setAssets] = useState<Load<ArtifactView>>({ state: "idle" });

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const selected =
    notebooks.state === "ready"
      ? notebooks.items.find((n) => n.id === selectedId) ?? null
      : null;

  const loadNotebooks = useCallback(async () => {
    setNotebooks({ state: "loading" });
    const res = await callNlm({ action: "list" });
    if (res.ok) {
      setNotebooks({ state: "ready", items: normalizeNotebooks(res.data) });
    } else {
      setNotebooks({ state: "error", error: res.error });
    }
  }, []);

  useEffect(() => {
    void loadNotebooks();
  }, [loadNotebooks]);

  // Lazy-load sources/artifacts when their tab opens for the selected notebook.
  useEffect(() => {
    if (tab !== "studio" || !selectedId) return;
    let active = true;
    setSources({ state: "loading" });
    void callNlm({ action: "sources", notebook: selectedId }).then((res) => {
      if (!active) return;
      setSources(
        res.ok
          ? { state: "ready", items: normalizeSources(res.data) }
          : { state: "error", error: res.error },
      );
    });
    return () => {
      active = false;
    };
  }, [tab, selectedId]);

  useEffect(() => {
    if (tab !== "assets" || !selectedId) return;
    let active = true;
    setAssets({ state: "loading" });
    void callNlm({ action: "artifacts", notebook: selectedId }).then((res) => {
      if (!active) return;
      setAssets(
        res.ok
          ? { state: "ready", items: normalizeArtifacts(res.data) }
          : { state: "error", error: res.error },
      );
    });
    return () => {
      active = false;
    };
  }, [tab, selectedId]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  function pickNotebook(id: string) {
    setSelectedId(id);
    // Reset dependent views so stale data never shows for the new notebook.
    setSources({ state: "idle" });
    setAssets({ state: "idle" });
    setChat([]);
  }

  async function ask() {
    const q = question.trim();
    if (!q || !selectedId || asking) return;
    setQuestion("");
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: q };
    const pendingId = crypto.randomUUID();
    setChat((c) => [...c, userMsg, { id: pendingId, role: "assistant", content: "", pending: true }]);
    setAsking(true);

    const res = await callNlm({ action: "chat", notebook: selectedId, question: q });
    setChat((c) =>
      c.map((m) =>
        m.id === pendingId
          ? {
              ...m,
              pending: false,
              content: res.ok
                ? extractAnswer(res.data) || "_(No answer returned.)_"
                : `⚠️ ${res.error}`,
            }
          : m,
      ),
    );
    setAsking(false);
  }

  return (
    <div className="panel mx-auto flex h-full max-w-4xl flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <Notebook size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">NotebookLM</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">
              {selected ? (
                <>active · <span className="text-white">{selected.title}</span></>
              ) : (
                "Browse, chat, and inspect your Google NotebookLM notebooks"
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadNotebooks()}
          className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white"
        >
          <RefreshCw size={13} className={notebooks.state === "loading" ? "animate-spin" : ""} />
          Refresh
        </button>
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
                  layoutId="nlm-tab"
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
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "library" && (
          <LibraryTab
            notebooks={notebooks}
            selectedId={selectedId}
            onPick={pickNotebook}
            onRetry={() => void loadNotebooks()}
          />
        )}
        {tab === "chat" && (
          <ChatTab
            selected={selected}
            chat={chat}
            question={question}
            asking={asking}
            scrollRef={chatScrollRef}
            onQuestion={setQuestion}
            onAsk={ask}
            onGoLibrary={() => setTab("library")}
          />
        )}
        {tab === "studio" && (
          <SourcesTab load={sources} selected={selected} onGoLibrary={() => setTab("library")} />
        )}
        {tab === "assets" && (
          <AssetsTab load={assets} selected={selected} onGoLibrary={() => setTab("library")} />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- shared --------------------------------- */

function CenterMessage({
  icon,
  title,
  detail,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <span className="text-[var(--color-ink-faint)]">{icon}</span>
      <p className="text-sm text-white">{title}</p>
      {detail && <p className="max-w-md text-xs leading-relaxed text-[var(--color-ink-dim)]">{detail}</p>}
      {action}
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <CenterMessage
      icon={<AlertTriangle size={28} className="text-[var(--color-amber)]" />}
      title="Couldn't reach NotebookLM"
      detail={error}
      action={
        onRetry ? (
          <button
            onClick={onRetry}
            className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white transition hover:bg-white/[0.07]"
          >
            Try again
          </button>
        ) : undefined
      }
    />
  );
}

function Spinner() {
  return (
    <div className="flex h-full items-center justify-center">
      <RefreshCw size={20} className="animate-spin text-[var(--color-ink-faint)]" />
    </div>
  );
}

/* --------------------------------- library --------------------------------- */

function LibraryTab({
  notebooks,
  selectedId,
  onPick,
  onRetry,
}: {
  notebooks: Load<NotebookView>;
  selectedId: string | null;
  onPick: (id: string) => void;
  onRetry: () => void;
}) {
  if (notebooks.state === "loading" || notebooks.state === "idle") return <Spinner />;
  if (notebooks.state === "error") return <ErrorState error={notebooks.error} onRetry={onRetry} />;
  if (notebooks.items.length === 0) {
    return (
      <CenterMessage
        icon={<Library size={28} />}
        title="No notebooks yet"
        detail="Create one in NotebookLM and it'll appear here."
      />
    );
  }
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {notebooks.items.map((nb) => {
          const active = nb.id === selectedId;
          return (
            <button
              key={nb.id}
              onClick={() => onPick(nb.id)}
              className={cn(
                "group flex flex-col gap-2 rounded-2xl border bg-white/[0.02] p-4 text-left transition",
                active ? "border-transparent" : "border-white/10 hover:border-white/20",
              )}
              style={active ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 28px -8px ${ACCENT}aa` } : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${ACCENT}22`, color: ACCENT }}
                >
                  <Notebook size={16} />
                </span>
                {active && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]"
                    style={{ background: `${ACCENT}22`, color: ACCENT }}
                  >
                    <Check size={11} strokeWidth={3} /> Active
                  </span>
                )}
              </div>
              <h3 className="font-display text-sm font-semibold text-white">{nb.title}</h3>
              <p className="truncate font-mono text-[10px] text-[var(--color-ink-faint)]">{nb.id}</p>
              {nb.meta.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {nb.meta.map((m) => (
                    <span
                      key={m}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[var(--color-ink-dim)]"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------- chat ----------------------------------- */

function ChatTab({
  selected,
  chat,
  question,
  asking,
  scrollRef,
  onQuestion,
  onAsk,
  onGoLibrary,
}: {
  selected: NotebookView | null;
  chat: ChatMsg[];
  question: string;
  asking: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onQuestion: (v: string) => void;
  onAsk: () => void;
  onGoLibrary: () => void;
}) {
  if (!selected) return <NoNotebook onGoLibrary={onGoLibrary} />;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {chat.length === 0 ? (
          <CenterMessage
            icon={<MessageSquare size={28} />}
            title={`Ask "${selected.title}" anything`}
            detail="Questions are answered from the notebook's sources via NotebookLM."
          />
        ) : (
          chat.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                  m.role === "assistant"
                    ? "border-white/10 bg-white/[0.04] text-[var(--color-ink-dim)]"
                    : "border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]",
                )}
                style={m.role === "assistant" ? { color: ACCENT, borderColor: `${ACCENT}55` } : undefined}
              >
                {m.role === "assistant" ? <Bot size={13} /> : <User size={13} />}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "assistant"
                    ? "border border-white/10 bg-white/[0.03] text-[var(--color-ink)]"
                    : "bg-gradient-to-br from-[var(--color-cyan)]/15 to-[var(--color-violet)]/15 text-white",
                )}
              >
                {m.pending ? (
                  <span className="inline-flex items-center gap-1 text-[var(--color-ink-dim)]">
                    <span className="typing-dot" />
                    <span className="typing-dot [animation-delay:160ms]" />
                    <span className="typing-dot [animation-delay:320ms]" />
                  </span>
                ) : m.role === "assistant" ? (
                  <Markdown source={m.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAsk();
        }}
        className="flex items-end gap-2 border-t border-white/5 px-5 py-3"
      >
        <textarea
          value={question}
          onChange={(e) => onQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onAsk();
            }
          }}
          rows={1}
          placeholder={`Ask ${selected.title}…`}
          className="h-11 max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:border-white/25 focus:bg-black/40"
        />
        <button
          type="submit"
          disabled={!question.trim() || asking}
          aria-label="Send"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[#04060d] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

/* -------------------------------- studio ----------------------------------- */

function SourcesTab({
  load,
  selected,
  onGoLibrary,
}: {
  load: Load<SourceView>;
  selected: NotebookView | null;
  onGoLibrary: () => void;
}) {
  if (!selected) return <NoNotebook onGoLibrary={onGoLibrary} />;
  if (load.state === "loading" || load.state === "idle") return <Spinner />;
  if (load.state === "error") return <ErrorState error={load.error} />;
  if (load.items.length === 0) {
    return <CenterMessage icon={<FileText size={28} />} title="No sources in this notebook" />;
  }
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <ul className="space-y-2">
        {load.items.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${ACCENT}1a`, color: ACCENT }}
            >
              <FileText size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">{s.title}</p>
              <p className="truncate font-mono text-[10px] text-[var(--color-ink-faint)]">{s.id}</p>
            </div>
            {s.type && (
              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-dim)]">
                {s.type}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------- assets ----------------------------------- */

function AssetsTab({
  load,
  selected,
  onGoLibrary,
}: {
  load: Load<ArtifactView>;
  selected: NotebookView | null;
  onGoLibrary: () => void;
}) {
  if (!selected) return <NoNotebook onGoLibrary={onGoLibrary} />;
  if (load.state === "loading" || load.state === "idle") return <Spinner />;
  if (load.state === "error") return <ErrorState error={load.error} />;
  if (load.items.length === 0) {
    return (
      <CenterMessage
        icon={<AudioLines size={28} />}
        title="No studio assets yet"
        detail="Audio overviews, reports, and summaries generated in NotebookLM show up here."
      />
    );
  }
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {load.items.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: `${ACCENT}1a`, color: ACCENT }}
              >
                <AudioLines size={16} />
              </span>
              {a.status && (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-dim)]">
                  {a.status}
                </span>
              )}
            </div>
            <p className="text-sm text-white">{a.title}</p>
            {a.type && <p className="text-[11px] text-[var(--color-ink-dim)]">{a.type}</p>}
            <p className="truncate font-mono text-[10px] text-[var(--color-ink-faint)]">{a.id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoNotebook({ onGoLibrary }: { onGoLibrary: () => void }) {
  return (
    <CenterMessage
      icon={<Notebook size={28} />}
      title="No notebook selected"
      detail="Pick a notebook in the Library tab to continue."
      action={
        <button
          onClick={onGoLibrary}
          className="mt-2 rounded-xl px-4 py-2 text-xs font-medium text-[#04060d] transition hover:opacity-90"
          style={{ background: ACCENT }}
        >
          Go to Library
        </button>
      }
    />
  );
}

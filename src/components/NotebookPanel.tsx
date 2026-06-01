"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  NotebookTabs,
  Library,
  MessageSquare,
  Layers,
  FolderOpen,
  RefreshCw,
  Send,
  Check,
  AlertTriangle,
  Bot,
  User,
  Download,
  Wand2,
  AudioLines,
  Video,
  Presentation,
  Network,
  Image as ImageIcon,
  HelpCircle,
  Table2,
  FileText,
  GalleryVerticalEnd,
  type LucideIcon,
} from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { MicButton, type MicHandle } from "@/components/MicButton";
import { cn } from "@/lib/utils";

/** Gold accent for the Notebook section (matches the sidebar entry). */
const ACCENT = "#fde047";

type TabId = "library" | "chat" | "studio" | "assets";

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "library", label: "Library", icon: Library },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "studio", label: "Studio", icon: Layers },
  { id: "assets", label: "Assets", icon: FolderOpen },
];

/** The nine studio artifact types, in the order the operator listed them. */
const ARTIFACTS: { type: string; label: string; icon: LucideIcon }[] = [
  { type: "audio", label: "Audio", icon: AudioLines },
  { type: "video", label: "Video", icon: Video },
  { type: "slide_deck", label: "Slide Deck", icon: Presentation },
  { type: "mind_map", label: "Mind Map", icon: Network },
  { type: "infographic", label: "Infographic", icon: ImageIcon },
  { type: "flashcards", label: "Flashcards", icon: GalleryVerticalEnd },
  { type: "quiz", label: "Quiz", icon: HelpCircle },
  { type: "data_table", label: "Data Table", icon: Table2 },
  { type: "report", label: "Report", icon: FileText },
];

const ARTIFACT_LABEL: Record<string, string> = Object.fromEntries(
  ARTIFACTS.map((a) => [a.type, a.label]),
);

/* --------------------------------- types ---------------------------------- */

interface Notebook {
  id: string;
  title: string;
  sourceCount: number;
  modifiedAt: string | null;
}

interface Artifact {
  id: string;
  type: string;
  title: string;
  status: string;
}

interface AssetFile {
  file: string;
  folder: string;
  ext: string;
  size: number;
  mtime: string;
  url: string;
}

type Load<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; items: T[] }
  | { state: "error"; error: string };

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  savedTo?: string | null;
};

type ApiResult = { ok: true; data: unknown } | { ok: false; error: string };

/* ------------------------------- api client ------------------------------- */

async function callApi(payload: Record<string, unknown>): Promise<ApiResult> {
  try {
    const res = await fetch("/api/notebook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as ApiResult;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ----------------------------- normalizers -------------------------------- */

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
}
function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

function normalizeNotebooks(data: unknown): Notebook[] {
  return asArray(data).map((n) => ({
    id: str(n.id),
    title: str(n.title) || "Untitled notebook",
    sourceCount: typeof n.source_count === "number" ? n.source_count : 0,
    modifiedAt: str(n.modified_at) || null,
  }));
}

function normalizeArtifacts(data: unknown): Artifact[] {
  return asArray(data).map((a) => ({
    id: str(a.artifact_id ?? a.id),
    type: str(a.type ?? a.artifact_type),
    title: str(a.title) || ARTIFACT_LABEL[str(a.type ?? a.artifact_type)] || "Artifact",
    status: str(a.status) || "unknown",
  }));
}

function normalizeAssets(data: unknown): AssetFile[] {
  return asArray(data).map((a) => ({
    file: str(a.file),
    folder: str(a.folder),
    ext: str(a.ext).toLowerCase(),
    size: typeof a.size === "number" ? a.size : 0,
    mtime: str(a.mtime),
    url: str(a.url),
  }));
}

/* -------------------------------- component -------------------------------- */

export function NotebookPanel() {
  const [tab, setTab] = useState<TabId>("library");
  const [notebooks, setNotebooks] = useState<Load<Notebook>>({ state: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const micRef = useRef<MicHandle>(null);

  const [pickedType, setPickedType] = useState<string>("audio");
  const [focusPrompt, setFocusPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [artifacts, setArtifacts] = useState<Load<Artifact>>({ state: "idle" });
  const [pulling, setPulling] = useState<Record<string, boolean>>({});

  const [assets, setAssets] = useState<Load<AssetFile>>({ state: "idle" });

  const selected =
    notebooks.state === "ready" ? notebooks.items.find((n) => n.id === selectedId) ?? null : null;
  const selectedTitle = selected?.title ?? "";

  const loadNotebooks = useCallback(async () => {
    setNotebooks({ state: "loading" });
    const res = await callApi({ action: "list" });
    setNotebooks(
      res.ok
        ? { state: "ready", items: normalizeNotebooks(res.data) }
        : { state: "error", error: res.error },
    );
  }, []);

  useEffect(() => {
    void loadNotebooks();
  }, [loadNotebooks]);

  const loadArtifacts = useCallback(async () => {
    if (!selectedId) return;
    setArtifacts({ state: "loading" });
    const res = await callApi({ action: "studio_status", notebookId: selectedId });
    setArtifacts(
      res.ok
        ? { state: "ready", items: normalizeArtifacts(res.data) }
        : { state: "error", error: res.error },
    );
  }, [selectedId]);

  const loadAssets = useCallback(async () => {
    if (!selectedId) return;
    setAssets({ state: "loading" });
    const res = await callApi({ action: "assets", notebookId: selectedId, title: selectedTitle });
    setAssets(
      res.ok
        ? { state: "ready", items: normalizeAssets(res.data) }
        : { state: "error", error: res.error },
    );
  }, [selectedId, selectedTitle]);

  // Lazy-load each tab's data the first time it's opened for the active notebook.
  useEffect(() => {
    if (tab === "studio" && selectedId && artifacts.state === "idle") void loadArtifacts();
  }, [tab, selectedId, artifacts.state, loadArtifacts]);
  useEffect(() => {
    if (tab === "assets" && selectedId && assets.state === "idle") void loadAssets();
  }, [tab, selectedId, assets.state, loadAssets]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  function pickNotebook(id: string) {
    setSelectedId(id);
    // Reset dependent views so stale data never shows for the new notebook.
    setChat([]);
    setArtifacts({ state: "idle" });
    setAssets({ state: "idle" });
    setGenNote(null);
  }

  async function ask() {
    const q = question.trim();
    if (!q || !selectedId || asking) return;
    setQuestion("");
    micRef.current?.reset();
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: q };
    const pendingId = crypto.randomUUID();
    setChat((c) => [...c, userMsg, { id: pendingId, role: "assistant", content: "", pending: true }]);
    setAsking(true);

    const res = await callApi({ action: "query", notebookId: selectedId, title: selectedTitle, query: q });
    setChat((c) =>
      c.map((m) => {
        if (m.id !== pendingId) return m;
        if (!res.ok) return { ...m, pending: false, content: `⚠️ ${res.error}` };
        const d = (res.data ?? {}) as { answer?: string; savedTo?: string | null };
        return {
          ...m,
          pending: false,
          content: d.answer || "_(No answer returned.)_",
          savedTo: d.savedTo ?? null,
        };
      }),
    );
    setAsking(false);
  }

  async function generate() {
    if (!selectedId || generating) return;
    setGenerating(true);
    setGenNote(null);
    const res = await callApi({
      action: "studio_create",
      notebookId: selectedId,
      title: selectedTitle,
      artifactType: pickedType,
      focusPrompt: focusPrompt.trim() || undefined,
    });
    if (res.ok) {
      setGenNote({
        kind: "ok",
        text: `${ARTIFACT_LABEL[pickedType] ?? pickedType} generation started — it'll appear below once NotebookLM finishes.`,
      });
      setFocusPrompt("");
      void loadArtifacts();
    } else {
      setGenNote({ kind: "err", text: res.error });
    }
    setGenerating(false);
  }

  async function pull(a: Artifact) {
    if (!selectedId || pulling[a.id]) return;
    setPulling((p) => ({ ...p, [a.id]: true }));
    const res = await callApi({
      action: "download",
      notebookId: selectedId,
      title: selectedTitle,
      artifactType: a.type,
      artifactId: a.id,
    });
    setPulling((p) => ({ ...p, [a.id]: false }));
    if (res.ok) {
      setGenNote({ kind: "ok", text: `Pulled ${ARTIFACT_LABEL[a.type] ?? a.type} to your vault.` });
      // Refresh the Assets tab so the new file is there when the user switches.
      void loadAssets();
    } else {
      setGenNote({ kind: "err", text: res.error });
    }
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
            <NotebookTabs size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Notebook</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">
              {selected ? (
                <>
                  active · <span className="text-white">{selected.title}</span>
                </>
              ) : (
                "Library, chat, studio, and assets — synced to your Obsidian vault"
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
                  layoutId="notebook-tab"
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
            micRef={micRef}
            onQuestion={setQuestion}
            onAsk={ask}
            onGoLibrary={() => setTab("library")}
          />
        )}
        {tab === "studio" && (
          <StudioTab
            selected={selected}
            pickedType={pickedType}
            onPickType={setPickedType}
            focusPrompt={focusPrompt}
            onFocusPrompt={setFocusPrompt}
            generating={generating}
            onGenerate={generate}
            note={genNote}
            artifacts={artifacts}
            pulling={pulling}
            onPull={pull}
            onRefresh={() => void loadArtifacts()}
            onGoLibrary={() => setTab("library")}
          />
        )}
        {tab === "assets" && (
          <AssetsTab
            selected={selected}
            load={assets}
            onRefresh={() => void loadAssets()}
            onGoLibrary={() => setTab("library")}
          />
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

function NoNotebook({ onGoLibrary }: { onGoLibrary: () => void }) {
  return (
    <CenterMessage
      icon={<NotebookTabs size={28} />}
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

function Note({ note }: { note: { kind: "ok" | "err"; text: string } }) {
  const ok = note.kind === "ok";
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs",
        ok
          ? "border-white/10 bg-white/[0.03] text-[var(--color-ink)]"
          : "border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 text-[var(--color-amber)]",
      )}
    >
      {ok ? (
        <Check size={14} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
      ) : (
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      )}
      <span>{note.text}</span>
    </div>
  );
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function formatBytes(n: number): string {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

/* --------------------------------- library --------------------------------- */

function LibraryTab({
  notebooks,
  selectedId,
  onPick,
  onRetry,
}: {
  notebooks: Load<Notebook>;
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
                  <NotebookTabs size={16} />
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
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[var(--color-ink-dim)]">
                  {nb.sourceCount} {nb.sourceCount === 1 ? "source" : "sources"}
                </span>
                {nb.modifiedAt && (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[var(--color-ink-faint)]">
                    {relTime(nb.modifiedAt)}
                  </span>
                )}
              </div>
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
  micRef,
  onQuestion,
  onAsk,
  onGoLibrary,
}: {
  selected: Notebook | null;
  chat: ChatMsg[];
  question: string;
  asking: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  micRef: React.RefObject<MicHandle | null>;
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
            detail="Answers come from the notebook's sources. Every exchange is saved to your Obsidian vault."
          />
        ) : (
          chat.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                  m.role === "assistant"
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]",
                )}
                style={m.role === "assistant" ? { color: ACCENT, borderColor: `${ACCENT}55` } : undefined}
              >
                {m.role === "assistant" ? <Bot size={13} /> : <User size={13} />}
              </div>
              <div className={cn("max-w-[80%]", m.role === "user" && "flex flex-col items-end")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
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
                {m.role === "assistant" && !m.pending && m.savedTo && (
                  <p className="mt-1 flex items-center gap-1 px-1 text-[10px] text-[var(--color-ink-faint)]">
                    <Check size={10} style={{ color: ACCENT }} /> saved · {m.savedTo}
                  </p>
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
        <MicButton value={question} onValueChange={onQuestion} ref={micRef} />
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

/* --------------------------------- studio ---------------------------------- */

function StudioTab({
  selected,
  pickedType,
  onPickType,
  focusPrompt,
  onFocusPrompt,
  generating,
  onGenerate,
  note,
  artifacts,
  pulling,
  onPull,
  onRefresh,
  onGoLibrary,
}: {
  selected: Notebook | null;
  pickedType: string;
  onPickType: (t: string) => void;
  focusPrompt: string;
  onFocusPrompt: (v: string) => void;
  generating: boolean;
  onGenerate: () => void;
  note: { kind: "ok" | "err"; text: string } | null;
  artifacts: Load<Artifact>;
  pulling: Record<string, boolean>;
  onPull: (a: Artifact) => void;
  onRefresh: () => void;
  onGoLibrary: () => void;
}) {
  const focusMic = useRef<MicHandle>(null);
  if (!selected) return <NoNotebook onGoLibrary={onGoLibrary} />;

  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      {/* Generator */}
      <section>
        <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-[var(--color-ink-faint)]">
          Generate artifact
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          {ARTIFACTS.map((a) => {
            const Icon = a.icon;
            const active = pickedType === a.type;
            return (
              <button
                key={a.type}
                onClick={() => onPickType(a.type)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition",
                  active
                    ? "border-transparent text-white"
                    : "border-white/10 bg-white/[0.02] text-[var(--color-ink-dim)] hover:border-white/20 hover:text-white",
                )}
                style={active ? { background: `${ACCENT}1a`, boxShadow: `0 0 0 1px ${ACCENT}` } : undefined}
              >
                <Icon size={15} style={active ? { color: ACCENT } : undefined} />
                <span className="truncate">{a.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-end gap-2">
          <div className="flex flex-1 items-end gap-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 focus-within:border-white/25">
            <input
              value={focusPrompt}
              onChange={(e) => onFocusPrompt(e.target.value)}
              placeholder="Focus / instructions (optional)…"
              className="h-8 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-[var(--color-ink-faint)]"
            />
            <MicButton
              value={focusPrompt}
              onValueChange={onFocusPrompt}
              ref={focusMic}
              className="h-8 w-8"
              iconSize={14}
            />
          </div>
          <button
            onClick={onGenerate}
            disabled={generating}
            className="flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-[#04060d] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {generating ? <RefreshCw size={15} className="animate-spin" /> : <Wand2 size={15} />}
            Generate
          </button>
        </div>

        {note && (
          <div className="mt-3">
            <Note note={note} />
          </div>
        )}
      </section>

      {/* Existing artifacts */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--color-ink-faint)]">
            Studio artifacts
          </p>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white"
          >
            <RefreshCw size={12} className={artifacts.state === "loading" ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {artifacts.state === "loading" || artifacts.state === "idle" ? (
          <div className="py-8">
            <Spinner />
          </div>
        ) : artifacts.state === "error" ? (
          <ErrorState error={artifacts.error} onRetry={onRefresh} />
        ) : artifacts.items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-[var(--color-ink-dim)]">
            No artifacts yet. Generate one above — it lands here when NotebookLM finishes.
          </p>
        ) : (
          <ul className="space-y-2">
            {artifacts.items.map((a) => {
              const meta = ARTIFACTS.find((x) => x.type === a.type);
              const Icon = meta?.icon ?? FileText;
              const busy = pulling[a.id];
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${ACCENT}1a`, color: ACCENT }}
                  >
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{a.title}</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
                      {meta?.label ?? a.type} · {a.status}
                    </p>
                  </div>
                  <button
                    onClick={() => onPull(a)}
                    disabled={busy}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-white transition hover:bg-white/[0.07] disabled:opacity-50"
                  >
                    {busy ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} style={{ color: ACCENT }} />
                    )}
                    {busy ? "Pulling…" : "Pull"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* --------------------------------- assets ---------------------------------- */

function AssetsTab({
  selected,
  load,
  onRefresh,
  onGoLibrary,
}: {
  selected: Notebook | null;
  load: Load<AssetFile>;
  onRefresh: () => void;
  onGoLibrary: () => void;
}) {
  if (!selected) return <NoNotebook onGoLibrary={onGoLibrary} />;
  if (load.state === "loading" || load.state === "idle") return <Spinner />;
  if (load.state === "error") return <ErrorState error={load.error} onRetry={onRefresh} />;
  if (load.items.length === 0) {
    return (
      <CenterMessage
        icon={<FolderOpen size={28} />}
        title="No assets pulled yet"
        detail="Pull a studio artifact and it'll render here — playable, viewable, inline."
      />
    );
  }
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <div className="mb-3 flex items-center justify-end">
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {load.items.map((a) => (
          <AssetCard key={a.file} asset={a} />
        ))}
      </div>
    </div>
  );
}

function AssetCard({ asset }: { asset: AssetFile }) {
  const ext = asset.ext;
  const isVideo = ext === "mp4" || ext === "mov" || ext === "webm";
  const isAudio = ext === "m4a" || ext === "mp3" || ext === "aac";
  const isImage = ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "webp";
  const isFrame = ext === "pdf" || ext === "html";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="overflow-hidden rounded-xl bg-black/40">
        {isVideo ? (
          <video controls preload="metadata" className="aspect-video w-full bg-black">
            <source src={asset.url} />
          </video>
        ) : isAudio ? (
          <div className="flex items-center px-3 py-6">
            <audio controls preload="metadata" className="w-full">
              <source src={asset.url} />
            </audio>
          </div>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url} alt={asset.file} className="max-h-72 w-full object-contain" />
        ) : isFrame ? (
          <iframe src={asset.url} title={asset.file} className="h-72 w-full bg-white" />
        ) : (
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-28 flex-col items-center justify-center gap-2 text-[var(--color-ink-dim)] transition hover:text-white"
          >
            <FileText size={26} />
            <span className="text-xs">Open {ext.toUpperCase()} file</span>
          </a>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="truncate font-mono text-[11px] text-white">{asset.file}</p>
        <span className="shrink-0 text-[10px] text-[var(--color-ink-faint)]">{formatBytes(asset.size)}</span>
      </div>
    </div>
  );
}

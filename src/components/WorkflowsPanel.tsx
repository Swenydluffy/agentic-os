"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Workflow as WorkflowIcon,
  Plus,
  Play,
  Trash2,
  Pencil,
  Check,
  X,
  RefreshCw,
  Clock,
} from "lucide-react";
import {
  ACCENT,
  Spinner,
  ErrorState,
  EmptyState,
  VaultSaveBadge,
  useVaultSave,
} from "@/components/panel-ui";
import { cn } from "@/lib/utils";

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: string[];
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
}

/** Starter templates the user can drop into the list. */
const TEMPLATES: Omit<Workflow, "id" | "enabled" | "lastRun">[] = [
  {
    name: "Post to Instagram",
    description: "Pull the latest puppy photo, caption it from the NotebookLM strategy, publish a Reel.",
    schedule: "Daily · 09:00",
    steps: ["Select best photo", "Generate caption from notebook", "Schedule Reel", "Log to Obsidian"],
  },
  {
    name: "SEO Audit",
    description: "Crawl the marketing site, score Core Web Vitals, file issues for regressions.",
    schedule: "Weekly · Mon 06:00",
    steps: ["Crawl sitemap", "Run Lighthouse", "Diff vs last week", "Open issues"],
  },
  {
    name: "Sync Obsidian",
    description: "Commit and push the Agentic OS vault folder to its backup git remote.",
    schedule: "Hourly",
    steps: ["git add Agentic OS/", "Commit with timestamp", "Push to vault remote"],
  },
  {
    name: "Backup Keys",
    description: "Export secrets from the vault and encrypt a backup bundle to cold storage.",
    schedule: "Weekly · Sun 02:00",
    steps: ["Read secrets", "Encrypt with age", "Upload bundle", "Verify checksum"],
  },
];

function relTime(iso: string | null): string {
  if (!iso) return "never run";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "ran just now";
  if (m < 60) return `ran ${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `ran ${h}h ago`;
  return `ran ${Math.round(h / 24)}d ago`;
}

/** Render the workflow set as an Obsidian note. */
function workflowsMarkdown(workflows: Workflow[]): string {
  const lines = [
    "---",
    `updated: ${new Date().toISOString()}`,
    "tags:",
    "  - agentic-os",
    "  - workflows",
    "type: workflows",
    "---",
    "",
    "# Workflows",
    "",
    `_${workflows.length} ${workflows.length === 1 ? "workflow" : "workflows"}_`,
    "",
  ];
  for (const w of workflows) {
    lines.push(
      `## ${w.name}`,
      "",
      `- Status: ${w.enabled ? "enabled" : "disabled"}`,
      `- Schedule: ${w.schedule}`,
      `- Last run: ${w.lastRun ?? "never"}`,
      "",
      w.description.trim() || "_No description._",
      "",
    );
    if (w.steps.length) {
      lines.push("Steps:");
      w.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function WorkflowsPanel() {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", steps: "" });
  const [runningId, setRunningId] = useState<string | null>(null);
  const { status, save } = useVaultSave();

  const syncVault = useCallback(
    (list: Workflow[]) => save([{ section: "Workflows", file: "workflows", content: workflowsMarkdown(list) }]),
    [save],
  );

  const fetchData = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/workflows");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to load workflows.");
      setWorkflows(json.data);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  /** Run a mutation and adopt the server's returned list, then sync the vault. */
  const mutate = useCallback(
    async (init: RequestInit & { url?: string }) => {
      const { url = "/api/workflows", ...rest } = init;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...rest,
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setWorkflows(json.data);
        syncVault(json.data);
      }
      return json;
    },
    [syncVault],
  );

  function addTemplate(t: (typeof TEMPLATES)[number]) {
    void mutate({ method: "POST", body: JSON.stringify({ ...t, enabled: false, lastRun: null }) });
  }
  function toggle(w: Workflow) {
    void mutate({ method: "PUT", body: JSON.stringify({ id: w.id, enabled: !w.enabled }) });
  }
  async function runNow(w: Workflow) {
    setRunningId(w.id);
    await mutate({ method: "PUT", body: JSON.stringify({ id: w.id, lastRun: new Date().toISOString() }) });
    setRunningId(null);
  }
  function remove(w: Workflow) {
    void mutate({ method: "DELETE", url: `/api/workflows?id=${encodeURIComponent(w.id)}` });
    if (editingId === w.id) setEditingId(null);
  }
  function beginEdit(w: Workflow) {
    setEditingId(w.id);
    setDraft({ name: w.name, description: w.description, steps: w.steps.join("\n") });
  }
  function saveEdit() {
    if (!editingId) return;
    const steps = draft.steps.split("\n").map((s) => s.trim()).filter(Boolean);
    void mutate({
      method: "PUT",
      body: JSON.stringify({ id: editingId, name: draft.name.trim() || "Untitled workflow", description: draft.description.trim(), steps }),
    });
    setEditingId(null);
  }

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <WorkflowIcon size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Workflows</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">
              Automations · synced to Obsidian
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase === "ready" && <VaultSaveBadge status={status} />}
          <button
            onClick={() => void fetchData()}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-[var(--color-ink-dim)] transition hover:bg-white/[0.07] hover:text-white"
          >
            <RefreshCw size={13} className={phase === "loading" ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {phase === "loading" ? (
          <Spinner label="Loading workflows…" />
        ) : phase === "error" ? (
          <ErrorState error={error} onRetry={() => void fetchData()} />
        ) : (
          <>
            {/* Templates */}
            <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-[var(--color-ink-faint)]">
              Add from template
            </p>
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => addTemplate(t)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-xs text-[var(--color-ink-dim)] transition hover:border-white/25 hover:text-white"
                >
                  <Plus size={13} style={{ color: ACCENT }} />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>

            {/* List */}
            {workflows.length === 0 ? (
              <EmptyState
                icon={<WorkflowIcon size={26} />}
                title="No workflows yet"
                detail="Add one from a template above to get started."
              />
            ) : (
              <ul className="space-y-2.5">
                {workflows.map((w) => (
                  <li
                    key={w.id}
                    className="fade-in rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                  >
                    {editingId === w.id ? (
                      <div className="space-y-2">
                        <input
                          value={draft.name}
                          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                          placeholder="Workflow name"
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm font-medium text-white outline-none focus:border-white/25"
                        />
                        <textarea
                          value={draft.description}
                          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                          placeholder="Description"
                          rows={2}
                          className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-[var(--color-ink)] outline-none focus:border-white/25"
                        />
                        <textarea
                          value={draft.steps}
                          onChange={(e) => setDraft((d) => ({ ...d, steps: e.target.value }))}
                          placeholder="One step per line"
                          rows={3}
                          className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-[var(--color-ink)] outline-none focus:border-white/25"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[var(--color-ink-dim)] transition hover:text-white"
                          >
                            <X size={13} /> Cancel
                          </button>
                          <button
                            onClick={saveEdit}
                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[#04060d] transition hover:opacity-90"
                            style={{ background: ACCENT }}
                          >
                            <Check size={13} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-white">{w.name}</h3>
                              <Toggle on={w.enabled} onClick={() => toggle(w)} />
                            </div>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--color-ink-faint)]">
                              <Clock size={11} /> {w.schedule} · {relTime(w.lastRun)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => void runNow(w)}
                              disabled={runningId === w.id}
                              title="Run now"
                              aria-label="Run now"
                              className="flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-xs text-white transition hover:bg-white/[0.07] disabled:opacity-50"
                            >
                              {runningId === w.id ? (
                                <RefreshCw size={12} className="spin" />
                              ) : (
                                <Play size={12} style={{ color: ACCENT }} />
                              )}
                              Run
                            </button>
                            <button
                              onClick={() => beginEdit(w)}
                              aria-label="Edit"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-ink-faint)] transition hover:bg-white/[0.06] hover:text-white"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => remove(w)}
                              aria-label="Delete"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-ink-faint)] transition hover:bg-[var(--color-danger)]/15 hover:text-[var(--color-danger)]"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {w.description && (
                          <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-dim)]">{w.description}</p>
                        )}
                        {w.steps.length > 0 && (
                          <ol className="mt-2 space-y-1">
                            {w.steps.map((s, i) => (
                              <li key={i} className="flex gap-2 text-[11px] text-[var(--color-ink-dim)]">
                                <span className="font-mono text-[var(--color-ink-faint)]">{i + 1}.</span>
                                {s}
                              </li>
                            ))}
                          </ol>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={on ? "Disable workflow" : "Enable workflow"}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition",
        on ? "border-transparent" : "border-white/15 bg-white/[0.06]",
      )}
      style={on ? { background: ACCENT } : undefined}
    >
      <span
        className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all",
          on ? "left-[18px]" : "left-0.5",
        )}
        style={on ? undefined : { background: "var(--color-ink-dim)" }}
      />
    </button>
  );
}

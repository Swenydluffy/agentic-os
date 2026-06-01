"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, AlertTriangle, Check, Cloud } from "lucide-react";
import { saveVaultMarkdown } from "@/lib/vault-client";
import { cn } from "@/lib/utils";

/** Shared blue accent for the Memory / Logs / Workflows panels. */
export const ACCENT = "#60a5fa";

/* ------------------------------ load helpers ------------------------------ */

export type Load<T> =
  | { state: "loading" }
  | { state: "ready"; data: T }
  | { state: "error"; error: string };

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-[var(--color-ink-faint)]">
      <RefreshCw size={22} className="spin" />
      {label && <p className="text-xs">{label}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 py-12 text-center">
      <AlertTriangle size={26} className="text-[var(--color-amber)]" />
      <p className="text-sm text-white">Something went wrong</p>
      <p className="max-w-md text-xs leading-relaxed text-[var(--color-ink-dim)]">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white transition hover:bg-white/[0.07]"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 py-12 text-center text-[var(--color-ink-faint)]">
      <span className="opacity-50">{icon}</span>
      <p className="text-sm text-white/90">{title}</p>
      {detail && <p className="max-w-md text-xs leading-relaxed text-[var(--color-ink-dim)]">{detail}</p>}
    </div>
  );
}

/* ------------------------------ vault saving ------------------------------ */

export type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "error"; detail: string };

export interface VaultFile {
  section: string;
  file: string;
  content: string;
  mode?: "replace" | "append";
}

/**
 * Debounced auto-save of one or more markdown files to the Obsidian vault.
 * Returns the current status plus a `save(files)` to call on every meaningful
 * change — rapid calls collapse into a single write.
 */
export function useVaultSave(delay = 600) {
  const [status, setStatus] = useState<SaveStatus>({ state: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const save = useCallback(
    (files: VaultFile[]) => {
      if (files.length === 0) return;
      setStatus({ state: "saving" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const results = await Promise.all(files.map((f) => saveVaultMarkdown(f)));
        const failed = results.find((r) => !r.ok);
        setStatus(
          failed && !failed.ok ? { state: "error", detail: failed.error } : { state: "saved" },
        );
      }, delay);
    },
    [delay],
  );

  return { status, save };
}

/** Green "Saved to Obsidian" badge (with saving / error variants). */
export function VaultSaveBadge({ status }: { status: SaveStatus }) {
  const meta: Record<SaveStatus["state"], { label: string; color: string; icon: React.ReactNode }> = {
    idle: { label: "Auto-saves to Obsidian", color: "var(--color-ink-faint)", icon: <Cloud size={12} /> },
    saving: { label: "Saving…", color: "var(--color-cyan)", icon: <RefreshCw size={12} className="spin" /> },
    saved: { label: "Saved to Obsidian", color: "var(--color-lime)", icon: <Check size={12} strokeWidth={3} /> },
    error: { label: "Save failed", color: "var(--color-danger)", icon: <AlertTriangle size={12} /> },
  };
  const m = meta[status.state];
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
      )}
      style={{ color: m.color, borderColor: `${m.color}44`, background: `${m.color}12` }}
      title={status.state === "error" ? status.detail : undefined}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Markdown } from "./Markdown";

type LoadState =
  | { state: "loading" }
  | { state: "ready"; markdown: string }
  | { state: "error"; detail: string };

type SaveState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved" }
  | { state: "error"; detail: string };

interface GuideResponse {
  ok: boolean;
  markdown?: string;
  error?: string;
  relativePath?: string;
}

export function GuidePanel() {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [save, setSave] = useState<SaveState>({ state: "idle" });

  useEffect(() => {
    let active = true;

    // Fetch the guide markdown to render it.
    void (async () => {
      try {
        const res = await fetch("/api/guide");
        const data = (await res.json()) as GuideResponse;
        if (!active) return;
        if (res.ok && data.ok && typeof data.markdown === "string") {
          setLoad({ state: "ready", markdown: data.markdown });
        } else {
          setLoad({ state: "error", detail: data.error ?? `HTTP ${res.status}` });
        }
      } catch (e) {
        if (active) setLoad({ state: "error", detail: e instanceof Error ? e.message : String(e) });
      }
    })();

    // Sync the guide into the vault (fire-and-forget) so it lands in Obsidian.
    setSave({ state: "saving" });
    void (async () => {
      try {
        const res = await fetch("/api/guide", { method: "POST" });
        const data = (await res.json()) as GuideResponse;
        if (!active) return;
        setSave(res.ok && data.ok ? { state: "saved" } : { state: "error", detail: data.error ?? `HTTP ${res.status}` });
      } catch (e) {
        if (active) setSave({ state: "error", detail: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-cyan)]/25 to-[var(--color-violet)]/25 text-[var(--color-cyan)]">
            <BookOpen size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">Guide</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">Build this system yourself with Claude</p>
          </div>
        </div>
        <SaveBadge save={save} />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        {load.state === "loading" && (
          <p className="text-sm text-[var(--color-ink-faint)]">Loading guide…</p>
        )}
        {load.state === "error" && (
          <p className="text-sm text-[var(--color-danger)]">Couldn&apos;t load the guide: {load.detail}</p>
        )}
        {load.state === "ready" && <Markdown source={load.markdown} />}
      </div>
    </div>
  );
}

function SaveBadge({ save }: { save: SaveState }) {
  const map: Record<SaveState["state"], { label: string; color: string }> = {
    idle: { label: "Vault sync", color: "var(--color-ink-faint)" },
    saving: { label: "Saving to vault…", color: "var(--color-cyan)" },
    saved: { label: "Saved to vault", color: "var(--color-lime)" },
    error: { label: "Vault save failed", color: "var(--color-danger)" },
  };
  const { label, color } = map[save.state];
  return (
    <span
      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
      style={{ color }}
      title={save.state === "error" ? save.detail : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      {label}
    </span>
  );
}

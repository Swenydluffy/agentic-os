"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, FolderOpen, Cpu, Bot, Zap, Wrench } from "lucide-react";

interface ResolvedConfig {
  vault: { path: string; folder: string };
  models: { opus: string; sonnet: string; haiku: string };
  agents: Array<{ id: string; name: string; model: string; enabled: boolean }>;
  detectedTools: string[];
  hermes: { url: string; configured: boolean };
}

interface ConfigResponse {
  ok: boolean;
  config?: ResolvedConfig;
  error?: string;
}

type LoadState =
  | { state: "loading" }
  | { state: "ready"; config: ResolvedConfig }
  | { state: "error"; detail: string };

export function SettingsPanel() {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/config");
        const data = (await res.json()) as ConfigResponse;
        if (!active) return;
        if (res.ok && data.ok && data.config) setLoad({ state: "ready", config: data.config });
        else setLoad({ state: "error", detail: data.error ?? `HTTP ${res.status}` });
      } catch (e) {
        if (active) setLoad({ state: "error", detail: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="panel mx-auto flex h-full max-w-2xl flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-violet)]/25 to-[var(--color-cyan)]/25 text-[var(--color-violet)]">
          <SlidersHorizontal size={18} />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-wide text-white">Settings</h2>
          <p className="text-xs text-[var(--color-ink-dim)]">Resolved configuration (read-only)</p>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {load.state === "loading" && <p className="text-sm text-[var(--color-ink-faint)]">Loading configuration…</p>}
        {load.state === "error" && (
          <p className="text-sm text-[var(--color-danger)]">Couldn&apos;t load configuration: {load.detail}</p>
        )}
        {load.state === "ready" && <ConfigView config={load.config} />}
      </div>
    </div>
  );
}

function ConfigView({ config }: { config: ResolvedConfig }) {
  const enabledAgents = config.agents.filter((a) => a.enabled);
  return (
    <>
      <Section icon={FolderOpen} title="Obsidian vault">
        <Row label="Path" value={config.vault.path || "—"} mono />
        <Row label="Folder" value={config.vault.folder} mono />
      </Section>

      <Section icon={Cpu} title="Models">
        <Row label="Opus" value={config.models.opus} mono />
        <Row label="Sonnet" value={config.models.sonnet} mono />
        <Row label="Haiku" value={config.models.haiku} mono />
      </Section>

      <Section icon={Bot} title="Agents">
        <Row label="Configured" value={`${enabledAgents.length} of ${config.agents.length} enabled`} />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {config.agents.map((a) => (
            <span
              key={a.id}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${
                a.enabled
                  ? "border-white/10 bg-white/[0.04] text-[var(--color-ink-dim)]"
                  : "border-white/5 bg-transparent text-[var(--color-ink-faint)] line-through"
              }`}
            >
              {a.name}
            </span>
          ))}
        </div>
      </Section>

      <Section icon={Zap} title="Hermes">
        <Row label="Server" value={config.hermes.url || "not configured"} mono />
        <Row label="Token" value={config.hermes.configured ? "set" : "not set"} />
      </Section>

      <Section icon={Wrench} title="Detected AI tools">
        {config.detectedTools.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {config.detectedTools.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[var(--color-lime)]/30 bg-[var(--color-lime)]/10 px-2 py-0.5 font-mono text-[11px] text-[var(--color-lime)]"
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-ink-faint)]">None detected on this machine.</p>
        )}
      </Section>

      <p className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-[var(--color-ink-faint)]">
        To change these: edit <span className="font-mono text-[var(--color-ink-dim)]">config.json</span> (vault, models,
        agents, Hermes) or <span className="font-mono text-[var(--color-ink-dim)]">.env.local</span> (API key), then
        re-run <span className="font-mono text-[var(--color-ink-dim)]">npm run setup</span> to re-detect tools and your
        vault.
      </p>
    </>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof FolderOpen;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-[var(--color-ink-dim)]">
        <Icon size={14} />
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em]">{title}</h3>
      </div>
      <div className="space-y-1.5 rounded-xl border border-white/5 bg-black/20 px-4 py-3">{children}</div>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-xs text-[var(--color-ink-faint)]">{label}</span>
      <span className={`truncate text-right text-sm text-[var(--color-ink)] ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

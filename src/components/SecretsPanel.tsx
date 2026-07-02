"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";

const ACCENT = "#fbbf24";

type HealthReason =
  | "online"
  | "invalid-key"
  | "missing-key"
  | "unreachable"
  | "error"
  | "untested";

interface SecretStatus {
  id: string;
  name: string;
  service: string | null;
  serviceLabel: string;
  color: string;
  active: boolean;
  checked: boolean;
  reason: HealthReason;
}

interface SecretsResponse {
  ok: boolean;
  items?: SecretStatus[];
  error?: string;
  code?: string;
}

type LoadState =
  | { state: "loading" }
  | { state: "ready"; items: SecretStatus[] }
  | { state: "error"; message: string };

/** Map a health reason to a card label, colour, and whether the dot pulses. */
const REASON_STATUS: Record<HealthReason, { label: string; color: string; pulse: boolean }> = {
  online: { label: "Active", color: "var(--color-lime)", pulse: true },
  "invalid-key": { label: "Key rejected", color: "var(--color-red, #f87171)", pulse: false },
  "missing-key": { label: "No key stored", color: "var(--color-amber)", pulse: false },
  unreachable: { label: "Unreachable", color: "var(--color-amber)", pulse: false },
  error: { label: "API error", color: "var(--color-red, #f87171)", pulse: false },
  untested: { label: "No health endpoint", color: "var(--color-ink-faint)", pulse: false },
};

interface SecretsPanelProps { onBack?: () => void; }
export function SecretsPanel({ onBack }: SecretsPanelProps = {}) {
  const [load, setLoad] = useState<LoadState>({ state: "loading" });

  const refresh = useCallback(async () => {
    setLoad({ state: "loading" });
    try {
      const res = await fetch("/api/secrets", { cache: "no-store" });
      const data = (await res.json()) as SecretsResponse;
      if (res.ok && data.ok && data.items) {
        setLoad({ state: "ready", items: data.items });
      } else {
        setLoad({ state: "error", message: data.error ?? "Couldn't read the vault." });
      }
    } catch {
      setLoad({ state: "error", message: "Couldn't reach /api/secrets." });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const checked = load.state === "ready" ? load.items.filter((i) => i.checked) : [];
  const online = checked.filter((i) => i.active).length;

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      {onBack && <div style={{padding:"10px 20px 0"}}><BackButton onBack={onBack} /></div>}
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${ACCENT}22`, color: ACCENT }}
        >
          <KeyRound size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-wide text-white">
            Secrets Vault
          </h2>
          <p className="text-xs text-[var(--color-ink-dim)]">
            Live keys from the <span className="font-mono">Tech-Dev</span> 1Password vault, each
            health-checked against its provider.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={load.state === "loading"}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[var(--color-ink-dim)] transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={cn(load.state === "loading" && "animate-spin")} />
          Re-check
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {load.state === "error" ? (
          <VaultError message={load.message} />
        ) : load.state === "loading" ? (
          <p className="font-mono text-xs text-[var(--color-ink-faint)]">
            Reading vault and probing providers…
          </p>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2 text-xs text-[var(--color-ink-dim)]">
              <ShieldCheck size={14} style={{ color: ACCENT }} />
              <span>
                <span className="font-mono text-white">{online}</span> of{" "}
                <span className="font-mono text-white">{checked.length}</span> provider keys live ·{" "}
                <span className="font-mono text-white">{load.items.length}</span> items in vault
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {load.items.map((item, i) => (
                <SecretCard key={item.id} item={item} index={i} />
              ))}
            </div>

            <p className="mt-5 text-xs leading-relaxed text-[var(--color-ink-faint)]">
              Keys are read server-side via the 1Password CLI and spent only on the health-check
              request — secret values never reach this panel. Items that aren&apos;t one of the six
              probed providers are listed as <span className="font-mono">Other</span> and shown
              without a status.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function VaultError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-red,#f87171)]/30 bg-[var(--color-red,#f87171)]/5 p-4">
      <p className="text-sm font-medium text-white">Vault unavailable</p>
      <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--color-ink-dim)]">{message}</p>
    </div>
  );
}

function SecretCard({ item, index }: { item: SecretStatus; index: number }) {
  const status = REASON_STATUS[item.reason];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.03, 0.3), ease: [0.2, 0.7, 0.2, 1] }}
      className="relative flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Provider logo colour */}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[#04060d]"
            style={{ background: item.color, boxShadow: `0 0 16px -4px ${item.color}` }}
          >
            {item.serviceLabel.charAt(0)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-sm font-semibold text-white" title={item.name}>
              {item.name}
            </h3>
            <p className="truncate text-[11px] text-[var(--color-ink-faint)]">{item.serviceLabel}</p>
          </div>
        </div>

        {/* Health indicator */}
        <span
          className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]"
          style={{ color: status.color }}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", status.pulse && "pulse-dot")}
            style={
              status.pulse
                ? undefined
                : { background: status.color, boxShadow: `0 0 8px ${status.color}` }
            }
          />
          {status.label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]"
          style={
            item.active
              ? {
                  borderColor: "var(--color-lime)",
                  color: "var(--color-lime)",
                  background: "color-mix(in srgb, var(--color-lime) 12%, transparent)",
                }
              : {
                  borderColor: "rgba(255,255,255,0.12)",
                  color: "var(--color-ink-faint)",
                }
          }
        >
          {item.active ? "● Active" : item.checked ? "○ Inactive" : "○ Untested"}
        </span>
      </div>
    </motion.div>
  );
}

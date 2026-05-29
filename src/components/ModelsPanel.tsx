"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Check } from "lucide-react";
import { MODEL_OPTIONS, type ModelOption, type ProviderId } from "@/lib/models";
import { useActiveModel } from "@/lib/useActiveModel";
import { cn } from "@/lib/utils";

const ACCENT = "#60a5fa";

type Availability = Record<ProviderId, boolean>;

interface ModelsResponse {
  ok: boolean;
  available?: Availability;
}

type AvailState =
  | { state: "loading" }
  | { state: "ready"; available: Availability }
  | { state: "error" };

export function ModelsPanel() {
  const { modelId, setModelId } = useActiveModel();
  const [avail, setAvail] = useState<AvailState>({ state: "loading" });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/models");
        const data = (await res.json()) as ModelsResponse;
        if (!active) return;
        if (res.ok && data.ok && data.available) {
          setAvail({ state: "ready", available: data.available });
        } else {
          setAvail({ state: "error" });
        }
      } catch {
        if (active) setAvail({ state: "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${ACCENT}22`, color: ACCENT }}
        >
          <BrainCircuit size={18} />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-wide text-white">Models</h2>
          <p className="text-xs text-[var(--color-ink-dim)]">
            Switch the AI model for the Claude Console — applied to every new message.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MODEL_OPTIONS.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              active={m.id === modelId}
              avail={avail}
              onUse={() => setModelId(m.id)}
            />
          ))}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-[var(--color-ink-faint)]">
          Claude (Anthropic) is wired in and active out of the box. OpenAI, xAI, and DeepSeek come
          fully online once their API key is set in <span className="font-mono">.env.local</span>;
          until then they reply in demo mode.
        </p>
      </div>
    </div>
  );
}

function statusFor(
  model: ModelOption,
  avail: AvailState,
): { label: string; color: string; pulse: boolean } {
  if (avail.state === "loading") {
    return { label: "Checking…", color: "var(--color-ink-faint)", pulse: false };
  }
  const online = avail.state === "ready" && avail.available[model.provider];
  if (online) return { label: "Online", color: "var(--color-lime)", pulse: true };
  return { label: "Demo mode", color: "var(--color-amber)", pulse: false };
}

function ModelCard({
  model,
  active,
  avail,
  onUse,
}: {
  model: ModelOption;
  active: boolean;
  avail: AvailState;
  onUse: () => void;
}) {
  const status = statusFor(model, avail);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border bg-white/[0.02] p-4 transition",
        active ? "border-transparent" : "border-white/10 hover:border-white/20",
      )}
      style={
        active
          ? { boxShadow: `0 0 0 1px ${model.color}, 0 0 28px -8px ${model.color}aa` }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Provider logo colour */}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[#04060d]"
            style={{ background: model.color, boxShadow: `0 0 16px -4px ${model.color}` }}
          >
            {model.providerLabel.charAt(0)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-sm font-semibold text-white">
                {model.name}
              </h3>
              {model.current && (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-[var(--color-ink-dim)]">
                  Current
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-[var(--color-ink-faint)]">
              {model.providerLabel}
            </p>
          </div>
        </div>

        {/* Status indicator */}
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

      <p className="text-xs leading-relaxed text-[var(--color-ink-dim)]">{model.tagline}</p>

      <button
        type="button"
        onClick={onUse}
        disabled={active}
        className={cn(
          "mt-auto flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
          active
            ? "cursor-default text-[#04060d]"
            : "border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]",
        )}
        style={active ? { background: model.color } : undefined}
      >
        {active ? (
          <>
            <Check size={15} strokeWidth={3} /> Active Model
          </>
        ) : (
          "Use This Model"
        )}
      </button>
    </motion.div>
  );
}

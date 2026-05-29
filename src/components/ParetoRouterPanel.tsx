"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Route, Send, StopCircle, Sparkles, Zap, DollarSign, Brain, Radio } from "lucide-react";
import {
  routeTask,
  categoryLabel,
  ROUTE_RULES,
  type RouteCategory,
  type RouteDecision,
} from "@/lib/pareto";
import { getModelOption } from "@/lib/models";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

const ACCENT = "#60a5fa";

const CATEGORY_ICON: Record<RouteCategory, typeof Brain> = {
  reasoning: Brain,
  speed: Zap,
  cost: DollarSign,
  realtime: Radio,
};

const EXAMPLES = [
  "Architect a fault-tolerant event queue and explain the trade-offs",
  "Quickly draft a regex to match email addresses",
  "Summarize these 500 support tickets as cheaply as possible",
  "What's the latest news on the OpenAI API pricing today?",
];

type Run =
  | { state: "idle" }
  | { state: "streaming"; text: string }
  | { state: "done"; text: string }
  | { state: "error"; error: string };

export function ParetoRouterPanel() {
  const [task, setTask] = useState("");
  const [override, setOverride] = useState<RouteCategory | null>(null);
  const [run, setRun] = useState<Run>({ state: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const auto = useMemo(() => routeTask(task), [task]);

  // The effective decision honors a manual override while keeping the live reason.
  const decision: RouteDecision = useMemo(() => {
    if (!override) return auto;
    const rule = ROUTE_RULES.find((r) => r.category === override) ?? ROUTE_RULES[0];
    return {
      ...auto,
      category: override,
      model: getModelOption(rule.modelId),
      strength: rule.strength,
      reason: `Manual override — routed to ${categoryLabel(override)} with ${getModelOption(rule.modelId).name}.`,
    };
  }, [auto, override]);

  const streaming = run.state === "streaming";

  async function send() {
    const content = task.trim();
    if (!content || streaming) return;

    setRun({ state: "streaming", text: "" });
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content }],
          provider: decision.model.provider,
          model: decision.model.model,
          system: `You are ${decision.model.name}, selected by the Pareto Code Router for a "${categoryLabel(decision.category)}" task. Answer precisely and stay in your lane.`,
        }),
        signal: ac.signal,
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setRun({ state: "streaming", text });
      }
      setRun({ state: "done", text });
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") {
        setRun((r) => (r.state === "streaming" ? { state: "done", text: r.text } : r));
      } else {
        setRun({ state: "error", error: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="panel mx-auto flex h-full max-w-3xl flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${ACCENT}22`, color: ACCENT }}
        >
          <Route size={18} />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold tracking-wide text-white">
            Pareto Code Router
          </h2>
          <p className="text-xs text-[var(--color-ink-dim)]">
            Describe a task — it routes to the model with the best cost/quality fit.
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
        {/* Task input */}
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          placeholder="Describe the task to route…  (⌘/Ctrl + Enter to run)"
          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--color-ink-faint)] focus:bg-black/40"
          style={{ minHeight: 84 }}
        />

        {task.trim().length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setTask(ex)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-[var(--color-ink-dim)] transition hover:border-white/20 hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Routing decision */}
        {task.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">
                Routing decision
              </span>
              {override && (
                <button
                  onClick={() => setOverride(null)}
                  className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-dim)] transition hover:text-white"
                >
                  Reset to auto
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-[#04060d]"
                style={{ background: decision.model.color, boxShadow: `0 0 18px -4px ${decision.model.color}` }}
              >
                {decision.model.providerLabel.charAt(0)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-semibold text-white">{decision.model.name}</h3>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]"
                    style={{ background: `${ACCENT}22`, color: ACCENT }}
                  >
                    {categoryLabel(decision.category)}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-ink-dim)]">
                  {decision.model.providerLabel} · {decision.strength}
                </p>
              </div>
            </div>

            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[var(--color-ink-dim)]">
              <Sparkles size={13} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
              {decision.reason}
            </p>

            {/* Confidence bars per category — click to override. */}
            <div className="mt-4 space-y-1.5">
              {ROUTE_RULES.map((rule) => {
                const Icon = CATEGORY_ICON[rule.category];
                const score = decision.scores[rule.category] ?? 0;
                const max = Math.max(1, ...Object.values(decision.scores));
                const pct = Math.round((score / max) * 100);
                const isChosen = decision.category === rule.category;
                return (
                  <button
                    key={rule.category}
                    onClick={() => setOverride(rule.category)}
                    className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.03]"
                    title={`Route manually to ${categoryLabel(rule.category)}`}
                  >
                    <Icon
                      size={13}
                      className="shrink-0"
                      style={{ color: isChosen ? ACCENT : "var(--color-ink-faint)" }}
                    />
                    <span
                      className={cn(
                        "w-28 shrink-0 text-[11px]",
                        isChosen ? "text-white" : "text-[var(--color-ink-dim)]",
                      )}
                    >
                      {categoryLabel(rule.category)}
                    </span>
                    <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: isChosen ? ACCENT : "var(--color-ink-faint)",
                        }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right font-mono text-[10px] text-[var(--color-ink-faint)]">
                      {score}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Send / Stop */}
            <div className="mt-4 flex justify-end">
              {streaming ? (
                <button
                  onClick={stop}
                  className="flex items-center gap-2 rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-2 text-sm text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/20"
                >
                  <StopCircle size={15} /> Stop
                </button>
              ) : (
                <button
                  onClick={() => void send()}
                  disabled={!task.trim()}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-[#04060d] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: ACCENT }}
                >
                  <Send size={15} /> Send to {decision.model.shortName}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Response */}
        {run.state !== "idle" && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: decision.model.color, boxShadow: `0 0 8px ${decision.model.color}` }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
                {decision.model.name}
                {run.state === "streaming" && " · streaming"}
              </span>
            </div>
            {run.state === "error" ? (
              <p className="text-sm text-[var(--color-danger)]">⚠️ {run.error}</p>
            ) : run.state === "streaming" && run.text.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-[var(--color-ink-dim)]">
                <span className="typing-dot" />
                <span className="typing-dot [animation-delay:160ms]" />
                <span className="typing-dot [animation-delay:320ms]" />
              </span>
            ) : (
              <div className="text-sm leading-relaxed text-[var(--color-ink)]">
                <Markdown source={run.text} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

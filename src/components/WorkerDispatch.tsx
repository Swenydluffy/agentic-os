"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, CheckCircle, Loader, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Worker {
  id: string;
  goal: string;
  model: string;
  status: "queued" | "running" | "done";
  result: string;
  elapsed: number;
  startedAt: number | null;
}

export function WorkerDispatch() {
  const [goal, setGoal] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [done, setDone] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [ticks, setTicks] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live elapsed timer
  useEffect(() => {
    if (!dispatching) return;
    const id = setInterval(() => setTicks((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [dispatching]);

  function getElapsed(w: Worker): number {
    if (w.status === "done") return w.elapsed;
    if (w.startedAt) return Date.now() - w.startedAt;
    return 0;
  }

  async function dispatch() {
    if (!goal.trim() || dispatching) return;
    setDispatching(true);
    setDone(false);
    setWorkers([]);
    setExpanded({});
    setTotalElapsed(0);

    try {
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim() }),
      });

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);

            if (msg.type === "worker_start") {
              setWorkers((ws) => [
                ...ws,
                {
                  id: msg.id,
                  goal: msg.goal,
                  model: msg.model,
                  status: "running",
                  result: "",
                  elapsed: 0,
                  startedAt: Date.now(),
                },
              ]);
            } else if (msg.type === "worker_chunk") {
              setWorkers((ws) =>
                ws.map((w) =>
                  w.id === msg.id ? { ...w, result: w.result + msg.chunk } : w
                )
              );
            } else if (msg.type === "worker_done") {
              setWorkers((ws) =>
                ws.map((w) =>
                  w.id === msg.id
                    ? { ...w, status: "done", result: msg.result, elapsed: msg.elapsed }
                    : w
                )
              );
            } else if (msg.type === "dispatch_done") {
              setDone(true);
              setTotalElapsed(msg.elapsed);
              setDispatching(false);
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setWorkers((ws) => [
        ...ws,
        { id: "err", goal: "Error", model: "", status: "done", result: `Dispatch failed: ${msg}`, elapsed: 0, startedAt: null },
      ]);
      setDispatching(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  const modelLabel = (model: string) =>
    model.includes("haiku") ? "HAIKU" : model.includes("sonnet") ? "SONNET" : model.split("-")[1]?.toUpperCase() ?? "?";

  const modelColor = (model: string) =>
    model.includes("haiku")
      ? { color: "var(--color-amber)", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)" }
      : { color: "var(--color-violet)", bg: "rgba(155,107,255,0.1)", border: "rgba(155,107,255,0.25)" };

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Header */}
      <div className="border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <Zap size={14} style={{ color: "var(--color-cyan)" }} />
          <span className="font-display text-sm font-semibold tracking-wide text-white">
            Worker Dispatch
          </span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">
            parallel agents
          </span>
        </div>
        <p className="mt-1 text-[11px] text-[var(--color-ink-dim)]">
          Hand off one goal — workers fan out and results stream back as each finishes
        </p>
      </div>

      {/* Input */}
      <div className="border-b border-white/5 px-5 py-3">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey) { e.preventDefault(); dispatch(); }
          }}
          rows={2}
          placeholder="Describe your goal… e.g. 'Run an SEO funnel for how to raise backyard chickens'"
          disabled={dispatching}
          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-[var(--color-ink-faint)] outline-none transition focus:border-[var(--color-cyan)]/50 focus:bg-black/40 disabled:opacity-50"
          style={{ minHeight: 64 }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-ink-faint)]">⌘ + Enter to dispatch</span>
          <button
            onClick={dispatch}
            disabled={!goal.trim() || dispatching}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
              "border-white/10 bg-gradient-to-r from-[var(--color-cyan)]/30 to-[var(--color-violet)]/30 text-white",
              "hover:from-[var(--color-cyan)]/50 hover:to-[var(--color-violet)]/50",
              "disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            {dispatching ? (
              <Loader size={13} className="animate-spin" />
            ) : (
              <Zap size={13} />
            )}
            {dispatching ? "Dispatching…" : "Dispatch Workers"}
          </button>
        </div>
      </div>

      {/* Job Board */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {workers.length === 0 && !dispatching && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Zap size={32} className="mx-auto mb-3 opacity-20" style={{ color: "var(--color-cyan)" }} />
              <p className="text-sm text-[var(--color-ink-faint)]">
                Enter a goal above to dispatch parallel workers
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">
                Each worker gets its own thread, context, and model
              </p>
            </div>
          </div>
        )}

        {workers.map((w) => {
          const mc = modelColor(w.model);
          const isExpanded = expanded[w.id] ?? false;
          const elapsedMs = getElapsed(w);
          const elapsedSec = (elapsedMs / 1000).toFixed(1);
          const resultLines = w.result.split("\n");
          const previewLines = resultLines.slice(-4).join("\n");

          return (
            <div
              key={w.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
            >
              {/* Worker header */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status dot */}
                <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                  {w.status === "running" ? (
                    <Loader size={14} className="animate-spin" style={{ color: "var(--color-cyan)" }} />
                  ) : w.status === "done" ? (
                    <CheckCircle size={14} style={{ color: "var(--color-lime)" }} />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-[var(--color-ink-faint)]" />
                  )}
                </div>

                {/* Worker ID */}
                <span
                  className="font-mono text-xs font-bold uppercase"
                  style={{ color: "var(--color-cyan)" }}
                >
                  {w.id.toUpperCase()}
                </span>

                {/* Model badge */}
                {w.model && (
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.15em]"
                    style={{ color: mc.color, background: mc.bg, border: `1px solid ${mc.border}` }}
                  >
                    {modelLabel(w.model)}
                  </span>
                )}

                {/* Elapsed */}
                <div className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-ink-faint)]">
                  <Clock size={10} />
                  <span className="font-mono">{elapsedSec}s</span>
                </div>

                {/* Expand toggle */}
                {w.result && (
                  <button
                    onClick={() => toggleExpand(w.id)}
                    className="text-[var(--color-ink-faint)] transition hover:text-white"
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                )}
              </div>

              {/* Sub-goal */}
              <div className="px-4 pb-2">
                <p className="line-clamp-2 text-[11px] text-[var(--color-ink-dim)]">
                  {w.goal}
                </p>
              </div>

              {/* Result */}
              {w.result && (
                <div className="border-t border-white/5 px-4 py-3">
                  <pre
                    className={cn(
                      "whitespace-pre-wrap font-mono text-[11px] text-[var(--color-ink)] leading-relaxed",
                      !isExpanded && "line-clamp-4"
                    )}
                  >
                    {isExpanded ? w.result : previewLines}
                  </pre>
                  {!isExpanded && resultLines.length > 4 && (
                    <button
                      onClick={() => toggleExpand(w.id)}
                      className="mt-1 text-[10px] text-[var(--color-cyan)] hover:underline"
                    >
                      Show full result ↓
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Summary row */}
        {done && workers.length > 0 && (
          <div
            className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(34,226,255,0.2)",
              background: "rgba(34,226,255,0.04)",
            }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={14} style={{ color: "var(--color-lime)" }} />
              <span className="font-medium text-white">All workers done</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--color-ink-faint)]">
              <span>{workers.length} workers</span>
              <span>·</span>
              <span>{(totalElapsed / 1000).toFixed(1)}s total</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

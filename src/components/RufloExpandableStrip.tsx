"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types (matches /api/ruflo GET response from src/lib/ruflo.ts) ─────────────
type AgentStatus = "running" | "idle" | "aborted" | "error";

interface RufloAgent {
  id: string;
  name: string;
  status: AgentStatus;
  task: string;
  model: string;
  totalTokens: number;
  updatedAt: number;
}

interface RufloData {
  online: boolean;
  activeAgents: number;
  totalAgents: number;
  targetAgents?: number;
  agents: RufloAgent[];
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAge(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  running: "#22c55e",
  idle:    "#60a5fa",
  aborted: "#f59e0b",
  error:   "#ef4444",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  running: "RUNNING",
  idle:    "IDLE",
  aborted: "ABORTED",
  error:   "ERROR",
};

// ─── Main component ───────────────────────────────────────────────────────────
export function RufloExpandableStrip() {
  const [data, setData]         = useState<RufloData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [stopping, setStopping] = useState<string | null>(null); // agent id
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/ruflo", { cache: "no-store" });
      const d = await r.json() as RufloData;
      setData(d);
    } catch {
      setData({ online: false, activeAgents: 0, totalAgents: 0, agents: [], error: "unreachable" });
    }
  }, []);

  useEffect(() => {
    void poll();
    const iv = setInterval(poll, 10_000);
    return () => clearInterval(iv);
  }, [poll]);

  function flash(msg: string) {
    setActionMsg(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActionMsg(null), 4000);
  }

  async function stopAll() {
    setStopping("all");
    try {
      const r = await fetch("/api/ruflo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stopAll" }),
      });
      const d = await r.json();
      if (d.ok) {
        flash(`Stopped ${d.stopped ?? "all"} agents`);
        void poll();
      } else {
        flash(`Error: ${d.error ?? "unknown"}`);
      }
    } catch (e) {
      flash(`Error: ${String(e)}`);
    }
    setStopping(null);
  }

  // ── Derived counts ──
  const agents  = data?.agents ?? [];
  const running = agents.filter(a => a.status === "running").length;
  const idle    = agents.filter(a => a.status === "idle").length;
  const errors  = agents.filter(a => a.status === "error").length;
  const total   = data?.totalAgents ?? agents.length;
  const online  = data?.online ?? false;

  const dotColor = !online ? "#ef4444" : running > 0 ? "#22c55e" : "#f59e0b";
  const summaryText = !data
    ? "RUFLO · …"
    : !online
    ? "RUFLO · offline"
    : `RUFLO · ${total} agent${total !== 1 ? "s" : ""} · ${running} active · ${idle} idle${errors > 0 ? ` · ${errors} error` : ""}`;

  return (
    <div style={{ flexShrink: 0 }}>
      <style>{`
        .ruflo-agent-row:hover { background: rgba(255,255,255,0.04) !important; }
        .ruflo-btn:hover:not(:disabled) { opacity: 0.8; }
        .ruflo-scroll::-webkit-scrollbar { width: 3px; }
        .ruflo-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
      `}</style>

      {/* ── Collapsed bar (always visible) ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          background: "#080c14",
          border: "none",
          borderBottom: expanded ? "none" : "1px solid #1f2937",
          borderTop: "none",
          cursor: "pointer",
          textAlign: "left",
          userSelect: "none",
        }}
      >
        {/* Pulse dot */}
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: dotColor, flexShrink: 0,
          boxShadow: online ? `0 0 5px ${dotColor}` : "none",
          animation: running > 0 ? "pdot 1.5s ease-in-out infinite" : "none",
        }} />
        <style>{`@keyframes pdot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }`}</style>

        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#9ca3af", flex: 1 }}>
          {summaryText}
        </span>

        {/* Action message flash */}
        {actionMsg && (
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#4ade80" }}>
            {actionMsg}
          </span>
        )}

        {/* Expand chevron */}
        <span style={{ fontSize: 11, color: "#4b5563" }}>
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div style={{
          background: "#0a0f1a",
          borderBottom: "1px solid #1f2937",
          maxHeight: 320,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderBottom: "1px solid #1f2937", flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#e5e7eb", flex: 1 }}>
              Ruflo Agent Fleet
            </span>

            {/* Count badges */}
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#166534", color: "#4ade80", fontWeight: 700 }}>
              {running} active
            </span>
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#0f1f3d", color: "#60a5fa", fontWeight: 700 }}>
              {idle} idle
            </span>
            {errors > 0 && (
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#450a0a", color: "#ef4444", fontWeight: 700 }}>
                {errors} error
              </span>
            )}

            {/* Stop all */}
            <button
              className="ruflo-btn"
              disabled={!online || stopping === "all" || total === 0}
              onClick={(e) => { e.stopPropagation(); void stopAll(); }}
              style={{
                fontSize: 10, padding: "3px 8px", borderRadius: 4,
                border: "1px solid #7f1d1d", background: "#450a0a",
                color: "#ef4444", cursor: "pointer", fontWeight: 600,
                opacity: (!online || total === 0) ? 0.4 : 1,
              }}
            >
              {stopping === "all" ? "Stopping…" : "Stop All"}
            </button>

            {/* Close */}
            <button
              onClick={() => setExpanded(false)}
              style={{ fontSize: 13, color: "#4b5563", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
            >
              ✕
            </button>
          </div>

          {/* Agent list */}
          <div className="ruflo-scroll" style={{ flex: 1, overflowY: "auto" }}>
            {!online ? (
              <div style={{ padding: 16, fontSize: 12, color: "#ef4444" }}>
                Ruflo gateway offline{data?.error ? `: ${data.error}` : ""}
              </div>
            ) : agents.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: "#6b7280" }}>
                No agents running.
              </div>
            ) : (
              agents.map(agent => {
                const col = STATUS_COLOR[agent.status] ?? "#6b7280";
                return (
                  <div
                    key={agent.id}
                    className="ruflo-agent-row"
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #111827",
                      background: "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Status dot */}
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: col, flexShrink: 0,
                        boxShadow: `0 0 5px ${col}`,
                      }} />

                      {/* Name */}
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {agent.name || agent.id}
                      </span>

                      {/* Status badge */}
                      <span style={{
                        fontSize: 9, padding: "2px 5px", borderRadius: 3,
                        fontWeight: 700, color: col,
                        background: `${col}18`, border: `1px solid ${col}40`,
                      }}>
                        {STATUS_LABEL[agent.status] ?? agent.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Row 2: task + model + age */}
                    <div style={{ display: "flex", gap: 8, marginTop: 3, marginLeft: 14 }}>
                      <span style={{ fontSize: 10, color: "#6b7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {agent.task || "—"}
                      </span>
                      {agent.model && (
                        <span style={{ fontSize: 9, color: "#4b5563", flexShrink: 0, fontFamily: "monospace" }}>
                          {agent.model.split("/").pop()}
                        </span>
                      )}
                      {agent.updatedAt > 0 && (
                        <span style={{ fontSize: 9, color: "#374151", flexShrink: 0, fontFamily: "monospace" }}>
                          {fmtAge(agent.updatedAt)}
                        </span>
                      )}
                    </div>

                    {/* Error details */}
                    {agent.status === "error" && agent.task && (
                      <div style={{ marginTop: 4, marginLeft: 14, fontSize: 10, color: "#ef4444", wordBreak: "break-word" }}>
                        ⚠ {agent.task}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: last updated */}
          <div style={{ padding: "4px 12px", borderTop: "1px solid #1f2937", fontSize: 9, color: "#374151", fontFamily: "monospace", flexShrink: 0 }}>
            Auto-refreshes every 10s · Stop All halts all running sessions
          </div>
        </div>
      )}
    </div>
  );
}

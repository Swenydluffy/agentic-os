"use client";

import { useEffect, useRef, useState } from "react";

type Status = "green" | "yellow" | "red" | "unknown";

interface HealthItem {
  id: string;
  label: string;
  status: Status;
  detail: string;
  updatedAt: string | null;
}

const DOT: Record<Status, string> = {
  green:   "#22c55e",
  yellow:  "#eab308",
  red:     "#ef4444",
  unknown: "#6b7280",
};

const GLOW: Record<Status, string> = {
  green:   "0 0 5px #22c55e88",
  yellow:  "0 0 5px #eab30888",
  red:     "0 0 5px #ef444488",
  unknown: "none",
};

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diffS = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diffS < 60)  return Math.round(diffS) + "s ago";
  if (diffS < 3600) return Math.round(diffS / 60) + "m ago";
  return (Math.round(diffS / 360) / 10) + "h ago";
}

const PLACEHOLDER: HealthItem[] = [
  { id: "vault",        label: "Vault",       status: "unknown", detail: "checking…", updatedAt: null },
  { id: "watcher",      label: "TG Watcher",  status: "unknown", detail: "checking…", updatedAt: null },
  { id: "brad-context", label: "Brad Context", status: "unknown", detail: "checking…", updatedAt: null },
  { id: "onnx",         label: "ONNX Index",  status: "unknown", detail: "checking…", updatedAt: null },
  { id: "mc-panels",    label: "MC Panels",   status: "unknown", detail: "checking…", updatedAt: null },
  { id: "phone",        label: "Phone",       status: "unknown", detail: "checking…", updatedAt: null },
];

export function MemoryHealthBar() {
  const [items, setItems] = useState<HealthItem[]>(PLACEHOLDER);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [tooltip, setTooltip] = useState<{ id: string; x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/memory-health", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as HealthItem[];
        setItems(data);
        setLastFetch(new Date());
      }
    } catch {
      /* silent — dots stay stale */
    }
  }

  useEffect(() => {
    void refresh();
    timerRef.current = setInterval(refresh, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "5px 12px",
        background: "rgba(0,0,0,0.35)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        backdropFilter: "blur(4px)",
        fontSize: 11,
        letterSpacing: "0.03em",
        height: 34,
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Label */}
      <span style={{ color: "#00FFFF", marginRight: 12, fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
        BRAIN MONITOR
      </span>

      {/* Indicators */}
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 14, cursor: "default", position: "relative" }}
          onMouseEnter={e => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setTooltip({ id: item.id, x: rect.left, y: rect.bottom + 4 });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Dot */}
          <span style={{
            display: "inline-block",
            width: 8,
height: 8,
borderRadius: "50%",
            background: DOT[item.status],
            boxShadow: GLOW[item.status],
            flexShrink: 0,
            
          }} />
          {/* Label */}
          <span style={{ color: item.status === "red" ? "#f87171" : item.status === "yellow" ? "#fbbf24" : "rgba(255,255,255,0.55)", fontFamily: "monospace", fontSize: 10 }}>
            {item.label}
          </span>
          {/* Separator */}
          {i < items.length - 1 && (
            <span style={{ color: "rgba(255,255,255,0.1)", marginLeft: 5, marginRight: -5, fontSize: 10 }}>·</span>
          )}
        </div>
      ))}

      {/* Last-updated timestamp */}
      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.18)", fontFamily: "monospace", fontSize: 9 }}>
        {lastFetch ? "↻ " + relTime(lastFetch.toISOString()) : "loading"}
      </span>

      {/* Tooltip */}
      {tooltip && (() => {
        const item = items.find(i => i.id === tooltip.id);
        if (!item) return null;
        return (
          <div
            style={{
              position: "fixed",
              left: tooltip.x,
              top: tooltip.y,
              zIndex: 9999,
              background: "rgba(10,12,18,0.97)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 11,
              color: "rgba(255,255,255,0.85)",
              maxWidth: 320,
              pointerEvents: "none",
              lineHeight: 1.5,
              boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2, color: DOT[item.status] }}>{item.label}</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>{item.detail}</div>
            {item.updatedAt && (
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 2 }}>
                Updated: {relTime(item.updatedAt)}
              </div>
            )}
          </div>
        );
      })()}

      {/* Pulse keyframe — injected inline once */}
      {/* no inline keyframes needed */}
    </div>
  );
}

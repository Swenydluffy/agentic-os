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
  if (diffS < 60)   return Math.round(diffS) + "s ago";
  if (diffS < 3600) return Math.round(diffS / 60) + "m ago";
  return (Math.round(diffS / 360) / 10) + "h ago";
}

// Only the 4 real indicators — placeholders match final IDs
const PLACEHOLDER: HealthItem[] = [
  { id: "vault",        label: "Obsidian Sync",  status: "unknown", detail: "checking…", updatedAt: null },
  { id: "watcher",      label: "Telegram → Vault", status: "unknown", detail: "checking…", updatedAt: null },
  { id: "phone",        label: "Phone → Vault",  status: "unknown", detail: "checking…", updatedAt: null },
  { id: "hermes-memory", label: "Hermes Memory", status: "unknown", detail: "checking…", updatedAt: null },
];

export function VaultStatusBar() {
  const [items, setItems] = useState<HealthItem[]>(PLACEHOLDER);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [tooltip, setTooltip] = useState<{ id: string; x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const [healthRes, memRes] = await Promise.all([
        fetch("/api/memory-health", { cache: "no-store" }),
        fetch("/api/hermes-memory", { cache: "no-store" }).catch(() => null),
      ]);

      if (!healthRes.ok) return;
      const allItems = await healthRes.json() as HealthItem[];

      // Pull only the 3 data-flow indicators we care about
      const vault   = allItems.find(i => i.id === "vault")   ?? PLACEHOLDER[0];
      const watcher = allItems.find(i => i.id === "watcher") ?? PLACEHOLDER[1];
      const phone   = allItems.find(i => i.id === "phone")   ?? PLACEHOLDER[2];

      // Hermes Memory from dedicated endpoint
      let memItem: HealthItem = { id: "hermes-memory", label: "Hermes Memory", status: "unknown", detail: "checking…", updatedAt: null };
      if (memRes?.ok) {
        try {
          const b = await memRes.json() as { pct?: number; chars?: number; limit?: number };
          const pct = b.pct ?? (b.chars && b.limit ? Math.round(b.chars / b.limit * 100) : null);
          if (pct !== null) {
            const status: Status = pct >= 90 ? "red" : pct >= 80 ? "yellow" : "green";
            memItem = {
              id: "hermes-memory",
              label: "Hermes Memory",
              status,
              detail: `${pct}% (${b.chars ?? "?"}/${b.limit ?? "?"} chars)`,
              updatedAt: new Date().toISOString(),
            };
          }
        } catch { /* keep unknown */ }
      }

      // Rename labels for clarity
      const renamed = (item: HealthItem, label: string): HealthItem => ({ ...item, label });

      setItems([
        renamed(vault,   "Obsidian Sync"),
        renamed(watcher, "Telegram → Vault"),
        renamed(phone,   "Phone → Vault"),
        memItem,
      ]);
      setLastFetch(new Date());
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
        height: 30,
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Strip label */}
      <span style={{
        color: "#60a5fa",
        marginRight: 12,
        fontSize: 9,
        fontFamily: "monospace",
        textTransform: "uppercase" as const,
        letterSpacing: "0.12em",
        fontWeight: 700,
        flexShrink: 0,
      }}>
        VAULT & HERMES STATUS
      </span>

      {/* 4 indicators */}
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 14, cursor: "default", position: "relative" as const }}
          onMouseEnter={e => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setTooltip({ id: item.id, x: rect.left, y: rect.bottom + 4 });
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          <span style={{
            display: "inline-block",
            width: 7, height: 7, borderRadius: "50%",
            background: DOT[item.status],
            boxShadow: GLOW[item.status],
            flexShrink: 0,
          }} />
          <span style={{
            color: item.status === "red"     ? "#f87171"
                 : item.status === "yellow"  ? "#fbbf24"
                 : "rgba(255,255,255,0.5)",
            fontFamily: "monospace",
            fontSize: 10,
          }}>
            {item.label}
          </span>
          {i < items.length - 1 && (
            <span style={{ color: "rgba(255,255,255,0.1)", marginLeft: 5, marginRight: -5, fontSize: 10 }}>·</span>
          )}
        </div>
      ))}

      {/* Timestamp */}
      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.18)", fontFamily: "monospace", fontSize: 9 }}>
        {lastFetch ? "↻ " + relTime(lastFetch.toISOString()) : "loading"}
      </span>

      {/* Tooltip */}
      {tooltip && (() => {
        const item = items.find(i => i.id === tooltip.id);
        if (!item) return null;
        return (
          <div style={{
            position: "fixed" as const,
            left: tooltip.x, top: tooltip.y,
            zIndex: 9999,
            background: "rgba(10,12,18,0.97)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 11,
            color: "rgba(255,255,255,0.85)",
            maxWidth: 280,
            pointerEvents: "none" as const,
            lineHeight: 1.5,
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}>
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
    </div>
  );
}

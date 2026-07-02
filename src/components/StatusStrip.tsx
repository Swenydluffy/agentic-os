"use client";
import { useEffect, useState } from "react";

type LightStatus = "green" | "yellow" | "red" | "unknown";

interface SystemHealth {
  hermesLight: LightStatus;
  obsidianLight: LightStatus;
}

const LIGHTS: Record<LightStatus, { color: string; glow: string }> = {
  green:   { color: "#22c55e", glow: "0 0 8px #22c55e" },
  yellow:  { color: "#eab308", glow: "0 0 8px #eab308" },
  red:     { color: "#ef4444", glow: "0 0 8px #ef4444" },
  unknown: { color: "#6b7280", glow: "none" },
};

export function StatusStrip() {
  const [health, setHealth] = useState<SystemHealth>({
    hermesLight: "unknown",
    obsidianLight: "unknown",
  });
  const [tooltip, setTooltip] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const r = await fetch("/api/system-health", { cache: "no-store" });
        if (r.ok && mounted) {
          setHealth(await r.json() as SystemHealth);
        }
      } catch { }
    }
    void poll();
    const iv = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "6px 14px", height: 30, flexShrink: 0,
      background: "rgba(0,0,0,0.35)",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      backdropFilter: "blur(4px)",
    }}>
      <span style={{ fontSize: 9, fontFamily: "monospace", color: "#60a5fa", 
        textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
        STATUS
      </span>

      {/* 🧠 Brain Light */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 5, cursor: "default" }}
        onMouseEnter={() => setTooltip("hermes")}
        onMouseLeave={() => setTooltip(null)}
      >
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: (LIGHTS[health.hermesLight] || LIGHTS.unknown).color,
          boxShadow: (LIGHTS[health.hermesLight] || LIGHTS.unknown).glow,
        }} />
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.6)" }}>
          🧠 Brain
        </span>
      </div>

      <span style={{ color: "rgba(255,255,255,0.1)" }}>·</span>

      {/* 📓 Vault Light */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 5, cursor: "default" }}
        onMouseEnter={() => setTooltip("obsidian")}
        onMouseLeave={() => setTooltip(null)}
      >
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: (LIGHTS[health.obsidianLight] || LIGHTS.unknown).color,
          boxShadow: (LIGHTS[health.obsidianLight] || LIGHTS.unknown).glow,
        }} />
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.6)" }}>
          📓 Vault
        </span>
      </div>
    </div>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mic, MicOff, ChevronDown, Circle } from "lucide-react";
import { getModelOption } from "@/lib/models";
import { StopButton } from "./StopButton";
import { useEffect, useRef, useState } from "react";
import { useActiveModel } from "@/lib/useActiveModel";

// ─── Clock ────────────────────────────────────────────────────────────────────
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── Live cost ────────────────────────────────────────────────────────────────
type CostData = { total?: number; burn_rate?: { cost_per_hour?: number } };
function useCost() {
  const [data, setData] = useState<CostData | null>(null);
  useEffect(() => {
    let mounted = true;
    async function fetch_() {
      try { const r = await fetch("/api/cost"); if (r.ok && mounted) setData(await r.json()); }
      catch { /* silent */ }
    }
    void fetch_();
    const iv = setInterval(fetch_, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);
  return data;
}

// ─── Real OpenRouter balance (polls /api/balance every 4s) ──────────────────
type BalanceData = { ok: boolean; remaining?: number; total_usage?: number; total_credits?: number };
function useBalance() {
  const [data, setData] = useState<BalanceData | null>(null);
  useEffect(() => {
    let mounted = true;
    async function poll() {
      try { const r = await fetch("/api/balance"); if (r.ok && mounted) setData(await r.json()); }
      catch { /* silent */ }
    }
    void poll();
    const iv = setInterval(poll, 4_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);
  return data;
}

// ─── Console LIVE/OFFLINE (pings /api/hermes every 20s) ──────────────────────
function useConsoleStatus() {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    async function ping() {
      try {
        const r = await fetch("/api/hermes", { method: "GET" });
        if (mounted) setLive(r.ok);
      } catch { if (mounted) setLive(false); }
    }
    void ping();
    const iv = setInterval(ping, 20_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);
  return live;
}

function fmt$(n: number) {
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 1)   return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

// ─── Master Mic Control ───────────────────────────────────────────────────────
const MIC_SOURCES = [
  { id: "iphone",   label: "iPhone Mic" },
  { id: "mac",      label: "Mac Built-in" },
  { id: "studio",   label: "Studio Display" },
  { id: "airpods",  label: "AirPods Pro" },
] as const;

type MicSourceId = typeof MIC_SOURCES[number]["id"];

// Broadcast mic source via localStorage so all panels pick it up
const MIC_SOURCE_KEY  = "mc_mic_source";
const MIC_MODE_KEY    = "mc_mic_mode";
const MIC_CAPTURE_KEY = "mc_always_on";

function useMicPrefs() {
  const [source,  setSourceState]  = useState<MicSourceId>("mac");
  const [mode,    setModeState]    = useState<"standard" | "isolation">("standard");
  const [capture, setCaptureState] = useState(false);

  useEffect(() => {
    setSourceState((localStorage.getItem(MIC_SOURCE_KEY) as MicSourceId) || "mac");
    setModeState((localStorage.getItem(MIC_MODE_KEY) as "standard" | "isolation") || "standard");
    setCaptureState(localStorage.getItem(MIC_CAPTURE_KEY) === "true");
  }, []);

  function setSource(v: MicSourceId) {
    setSourceState(v);
    localStorage.setItem(MIC_SOURCE_KEY, v);
    window.dispatchEvent(new StorageEvent("storage", { key: MIC_SOURCE_KEY, newValue: v }));
  }
  function setMode(v: "standard" | "isolation") {
    setModeState(v);
    localStorage.setItem(MIC_MODE_KEY, v);
  }
  function setCapture(v: boolean) {
    setCaptureState(v);
    localStorage.setItem(MIC_CAPTURE_KEY, String(v));
    window.dispatchEvent(new StorageEvent("storage", { key: MIC_CAPTURE_KEY, newValue: String(v) }));
  }
  return { source, setSource, mode, setMode, capture, setCapture };
}

function MasterMicControl() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { source, setSource, mode, setMode, capture, setCapture } = useMicPrefs();

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const isRecording = capture;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Master Mic Control"
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: 8,
          border: `1px solid ${isRecording ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.12)"}`,
          background: isRecording ? "rgba(239,68,68,0.1)" : "rgba(0,0,0,0.25)",
          color: isRecording ? "#ef4444" : "#9ca3af",
          fontSize: 11, fontWeight: 600, cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = isRecording ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "#ffffff"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = isRecording ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.12)"; e.currentTarget.style.color = isRecording ? "#ef4444" : "#9ca3af"; }}
      >
        {/* Pulse dot when recording */}
        {isRecording && (
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", flexShrink: 0,
            animation: "pulse 1.4s ease-in-out infinite", boxShadow: "0 0 6px #ef4444" }} />
        )}
        {isRecording ? <Mic size={12} /> : <MicOff size={12} />}
        <span style={{ maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isRecording ? "REC" : "MIC"}
        </span>
        <ChevronDown size={9} style={{ opacity: 0.5, flexShrink: 0 }} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 9999,
              background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10, padding: "8px 0", minWidth: 220,
              boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            }}
          >
            {/* Section: Source */}
            <div style={{ padding: "4px 12px 6px", fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "#4b5563", textTransform: "uppercase" }}>
              Mic Source — applies to all panels
            </div>
            {MIC_SOURCES.map(s => (
              <button key={s.id} type="button" onClick={() => setSource(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "7px 12px", border: "none",
                  background: source === s.id ? "rgba(255,255,255,0.06)" : "transparent",
                  color: source === s.id ? "#ffffff" : "#9ca3af",
                  fontSize: 12, fontWeight: source === s.id ? 600 : 400,
                  cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = source === s.id ? "rgba(255,255,255,0.06)" : "transparent"; e.currentTarget.style.color = source === s.id ? "#fff" : "#9ca3af"; }}
              >
                <Mic size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
                {s.label}
                {source === s.id && <span style={{ marginLeft: "auto", fontSize: 9, color: "#60a5fa", fontWeight: 700 }}>ACTIVE</span>}
              </button>
            ))}

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />

            {/* Section: Voice Mode */}
            <div style={{ padding: "4px 12px 6px", fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "#4b5563", textTransform: "uppercase" }}>
              Voice Mode
            </div>
            {(["standard", "isolation"] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "7px 12px", border: "none",
                  background: mode === m ? "rgba(255,255,255,0.06)" : "transparent",
                  color: mode === m ? "#ffffff" : "#9ca3af",
                  fontSize: 12, fontWeight: mode === m ? 600 : 400,
                  cursor: "pointer", textAlign: "left",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = mode === m ? "rgba(255,255,255,0.06)" : "transparent"; e.currentTarget.style.color = mode === m ? "#fff" : "#9ca3af"; }}
              >
                <Circle size={9} style={{ flexShrink: 0, opacity: mode === m ? 1 : 0.4 }} />
                {m === "standard" ? "Standard" : "Voice Isolation"}
                {mode === m && <span style={{ marginLeft: "auto", fontSize: 9, color: "#60a5fa", fontWeight: 700 }}>ON</span>}
              </button>
            ))}

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "6px 0" }} />

            {/* Section: Always-On Capture */}
            <div style={{ padding: "4px 12px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "#4b5563", textTransform: "uppercase" }}>
              24/7 NeuroSync Capture
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}>
              <div>
                <div style={{ fontSize: 12, color: capture ? "#ef4444" : "#9ca3af", fontWeight: capture ? 600 : 400 }}>
                  {capture ? "● Recording" : "○ Paused"}
                </div>
                <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>
                  Vault capture · passive
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCapture(!capture)}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                  border: `1px solid ${capture ? "rgba(239,68,68,0.4)" : "rgba(96,165,250,0.3)"}`,
                  background: capture ? "rgba(239,68,68,0.1)" : "rgba(96,165,250,0.08)",
                  color: capture ? "#ef4444" : "#60a5fa", cursor: "pointer",
                }}
              >
                {capture ? "Stop" : "Start"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const now   = useNow();
  const live    = useConsoleStatus();

  // Poll /api/model directly — avoids cross-chunk module singleton issues
  const [modelId, setModelIdState] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    async function pollModel() {
      try {
        const r = await fetch("/api/model");
        if (r.ok && mounted) {
          const d = await r.json();
          if (d.model) setModelIdState(d.model);
        }
      } catch { /* silent */ }
    }
    void pollModel();
    const iv = setInterval(pollModel, 3000); // 3s — fast enough to feel live
    return () => { mounted = false; clearInterval(iv); };
  }, []);
  const model = getModelOption(modelId);

  const time = now ? now.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit" }) : "--:--:--";
  const date = now ? now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "";

  // live === null means still loading (first ping)
  const liveColor = live === null ? "#6b7280" : live ? "#4ade80" : "#ef4444";
  const liveLabel = live === null ? "…" : live ? "LIVE" : "OFFLINE";

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative z-30 flex h-14 items-center gap-3 border-b border-white/5 px-5 backdrop-blur-xl"
    >
      {/* Logo + title */}
      <div className="flex items-center gap-3 shrink-0">
        <Logo />
        <div className="flex flex-col leading-none">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">
            Mission Control
          </span>
          <span className="text-sm font-semibold tracking-wide hue">C · M · C</span>
        </div>
      </div>

      <div className="mx-2 h-7 w-px bg-white/10 shrink-0" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Master Mic Control */}
      <MasterMicControl />

      {/* Active model + LIVE/OFFLINE badge — updates live */}
      <div
        className="hidden items-center gap-2 rounded-full border px-3 py-1.5 md:flex shrink-0"
        style={{
          borderColor: `${liveColor}33`,
          background: `${liveColor}09`,
        }}
        title={`${model.name} · ${model.providerLabel} · ${liveLabel}`}
      >
        {/* Model color dot */}
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ background: model.color, boxShadow: `0 0 8px ${model.color}` }}
        />
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-ink-dim)]">
          {model.shortName}
        </span>
        {/* Live status separator + dot */}
        <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
        <span
          style={{
            width: 6, height: 6, borderRadius: "50%", background: liveColor, flexShrink: 0,
            boxShadow: live ? `0 0 6px ${liveColor}` : "none",
            animation: live ? "pulse 2s ease-in-out infinite" : "none",
          }}
        />
        <span style={{ fontSize: 10, fontWeight: 700, color: liveColor, letterSpacing: "0.05em" }}>
          {liveLabel}
        </span>
      </div>

      {/* Clock only — no ONLINE pill (LIVE badge in model badge is enough) */}
      <div className="hidden items-center md:flex shrink-0">
        <div className="flex flex-col items-end leading-none">
          <span style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{time}</span>
          <span style={{ fontFamily: "inherit", fontSize: 10, fontWeight: 500, color: "#e5e7eb", textTransform: "uppercase", letterSpacing: "0.06em" }}>{date}</span>
        </div>
      </div>

      {/* Emergency PANIC button — far right */}
      <StopButton />
    </motion.header>
  );
}

function Logo() {
  return (
    <div className="relative h-8 w-8 shrink-0">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[var(--color-cyan)] via-[var(--color-violet)] to-[var(--color-magenta)] opacity-90 blur-[2px]" />
      <div className="absolute inset-[2px] rounded-[10px] bg-[#04060d]" />
      <Sparkles size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
    </div>
  );
}

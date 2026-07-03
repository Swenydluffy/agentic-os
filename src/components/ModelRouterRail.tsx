"use client";
import { useState, useEffect, useCallback } from "react";
import { useActiveModel } from "@/lib/useActiveModel";

type ModelEntry = {
  id: string; label: string; tier: "top" | "mid" | "budget";
  inputPer1M: number; outputPer1M: number; strengths: string[]; color: string;
};
type ProviderGroup = { provider: string; color: string; models: ModelEntry[] };

const PROVIDERS: ProviderGroup[] = [
  { provider: "Anthropic", color: "#e07950", models: [
    { id: "anthropic/claude-opus-4.8",  label: "Opus 4.8",   tier: "top",    inputPer1M: 15,   outputPer1M: 75,   strengths: ["complex reasoning","hard coding"],    color: "#e07950" },
    { id: "anthropic/claude-sonnet-4.6",label: "Sonnet 4.6", tier: "top",    inputPer1M: 3,    outputPer1M: 15,   strengths: ["all-around","coding","writing"],        color: "#e07950" },
    { id: "anthropic/claude-haiku-4.5", label: "Haiku 4.5",  tier: "mid",    inputPer1M: 1,    outputPer1M: 5,    strengths: ["fast chat","quick tasks"],              color: "#e07950" },
  ]},
  { provider: "OpenAI", color: "#10a37f", models: [
    { id: "openai/gpt-5.5",      label: "GPT-5.5",      tier: "top",    inputPer1M: 10,   outputPer1M: 30,   strengths: ["reasoning","all-around"],   color: "#10a37f" },
    { id: "openai/gpt-5.5-pro",  label: "GPT-5.5 Pro",  tier: "top",    inputPer1M: 30,   outputPer1M: 60,   strengths: ["deep reasoning"],            color: "#10a37f" },
    { id: "openai/gpt-5.4",      label: "GPT-5.4",      tier: "mid",    inputPer1M: 5,    outputPer1M: 15,   strengths: ["all-around","value"],        color: "#10a37f" },
    { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini", tier: "budget", inputPer1M: 0.40, outputPer1M: 1.60, strengths: ["quick tasks"],               color: "#10a37f" },
  ]},
  { provider: "Google", color: "#4285f4", models: [
    { id: "google/gemini-3.1-pro-preview",label: "Gemini 3.1 Pro",  tier: "top",    inputPer1M: 7,     outputPer1M: 21,   strengths: ["long docs","vision","research"], color: "#4285f4" },
    { id: "google/gemini-3.5-flash",      label: "Gemini 3.5 Flash",tier: "mid",    inputPer1M: 0.15,  outputPer1M: 0.60, strengths: ["fast","long-context"],           color: "#4285f4" },
    { id: "google/gemini-3.1-flash-lite", label: "G3.1 Lite",       tier: "budget", inputPer1M: 0.075, outputPer1M: 0.30, strengths: ["fast","cheap"],                  color: "#4285f4" },
  ]},
  { provider: "xAI", color: "#1da1f2", models: [
    { id: "x-ai/grok-4.3", label: "Grok 4.3", tier: "top", inputPer1M: 3, outputPer1M: 15, strengths: ["reasoning","current info"], color: "#1da1f2" },
  ]},
  { provider: "DeepSeek", color: "#7c6af7", models: [
    { id: "deepseek/deepseek-v4-pro",  label: "DS V4 Pro",  tier: "mid",    inputPer1M: 0.27, outputPer1M: 1.10, strengths: ["coding","technical","value"], color: "#7c6af7" },
    { id: "deepseek/deepseek-v4-flash", label: "DS V4 Flash",tier: "budget", inputPer1M: 0.07, outputPer1M: 0.28, strengths: ["cheap coding"],               color: "#7c6af7" },
  ]},
  { provider: "Meta", color: "#0867ff", models: [
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", tier: "budget", inputPer1M: 0.10, outputPer1M: 0.32, strengths: ["general open-model"], color: "#0867ff" },
  ]},
];

const TIER_DOT:   Record<string, string> = { top: "#f59e0b", mid: "#60a5fa", budget: "#4ade80" };
const TIER_LABEL: Record<string, string> = { top: "TOP", mid: "MID", budget: "BUDGET" };
const TIER_BG:    Record<string, string> = { top: "rgba(245,158,11,0.12)", mid: "rgba(96,165,250,0.12)", budget: "rgba(74,222,128,0.12)" };

type ModelSpend = { model: string; sessions: number; cost: number; input_tokens: number; output_tokens: number; last_used: string };
type BurnRate   = { cost_per_min: number; cost_per_hour: number; last_updated: string };
type CostData   = { total?: number; total_all_time?: number; limit?: number; timestamp?: string; day_start_et?: string; models?: ModelSpend[]; burn_rate?: BurnRate };
type ModelData  = { model?: string; provider?: string; in_sync?: boolean };
type BalData    = { ok: boolean; remaining?: number; total_credits?: number; total_usage?: number };

function fmt$(n: number): string {
  return '$' + n.toFixed(2);
}
function Spinner() {
  return <span style={{ display:"inline-block", width:11, height:11, border:"2px solid rgba(255,255,255,0.15)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", verticalAlign:"middle" }} />;
}


export function ModelRouterRail() {
  const [cost, setCost]       = useState<CostData | null>(null);
  const [costErr, setCostErr] = useState<string | null>(null);
  const [model, setModel]     = useState<ModelData | null>(null);
  const [bal, setBal]         = useState<BalData | null>(null);
  const [switching, setSwitching]       = useState<string | null>(null);
  const [justSwitched, setJustSwitched] = useState<string | null>(null);
  const [collapsed, setCollapsed]       = useState<Record<string, boolean>>({});
  const [balRefreshing, setBalRefreshing] = useState(false);
  const [balFlash, setBalFlash] = useState(false);
  const [balLastUpdated, setBalLastUpdated] = useState<Date | null>(null);
  const { setModelId } = useActiveModel();

  const fetchCost = useCallback(async () => {
    try {
      const r = await fetch("/api/cost");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCost(await r.json()); setCostErr(null);
    } catch (e) { setCostErr(String(e)); }
  }, []);

  const fetchBal = useCallback(async () => {
    try {
      const r = await fetch("/api/balance?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) { setBal(await r.json()); setBalLastUpdated(new Date()); }
    } catch { /* silent */ }
  }, []);

  const fetchModel = useCallback(async () => {
    try {
      const r = await fetch("/api/model");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setModel(await r.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCost(); fetchModel(); fetchBal();
    const iv  = setInterval(fetchCost, 15_000);
    const iv2 = setInterval(fetchBal,   5_000);
    return () => { clearInterval(iv); clearInterval(iv2); };
  }, [fetchCost, fetchModel, fetchBal]);

  const switchModel = async (id: string) => {
    if (switching) return;
    setSwitching(id); setJustSwitched(null);
    try {
      const r = await fetch("/api/model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: id, provider: "openrouter" }),
      });
      const d = await r.json();
      if (d.ok !== false) {
        setModel(d); setJustSwitched(id);
        setTimeout(fetchModel, 500);
        setTimeout(() => setJustSwitched(null), 5000);
      }
    } catch { /* ignore */ }
    setSwitching(null);
  };

  const activeId  = model?.model ?? "";
  const total     = cost?.total ?? 0;
  const allTime   = cost?.total_all_time;
  const limit     = cost?.limit ?? 200;
  const pct       = Math.min((total / limit) * 100, 100);
  const barColor  = pct > 85 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#22c55e";
  const remaining = bal?.remaining;
  const balColor  = remaining !== undefined && remaining < 10 ? "#ef4444" : "#4ade80";
  const balBorder = remaining !== undefined && remaining < 10 ? "#7f1d1d" : "#166534";
  const balBg     = remaining !== undefined && remaining < 10 ? "rgba(239,68,68,0.08)" : "#080c14";
  const activeLabel = PROVIDERS.flatMap(p => p.models).find(m => m.id === activeId)?.label
    ?? (activeId ? activeId.split("/").pop() : "—");

  return (
    <div style={{
      width: "100%", minWidth: 0, maxWidth: "100%",
      height: "100%", display: "flex", flexDirection: "column",
      background: "#0d1117", borderRight: "1px solid #1f2937",
      fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif",
      color: "#f9fafb", overflow: "hidden", flexShrink: 0,
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pdot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
        .mr-row:hover { background: rgba(255,255,255,0.05) !important; }
        .mr-ph:hover  { background: #1a2235 !important; cursor: pointer; }
        .mr-sb:hover:not(:disabled) { opacity: 0.8; }
        .mr-scroll::-webkit-scrollbar { width: 4px; }
        .mr-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
        .mr-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* ── PINNED HEADER ── */}
      <div style={{ padding: "14px 16px 12px", flexShrink: 0, borderBottom: "1px solid #1f2937" }}>
        {/* Title row */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#f9fafb", letterSpacing:"-0.2px" }}>🧭 Model Router</span>
          <span style={{ fontSize:10, color:"#4b5563", fontFamily:"monospace" }}>{cost?.timestamp?.slice(11,16) ?? "--:--"}</span>
        </div>

        {/* Daily + all-time spend */}
        <div style={{ marginBottom:6 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
            <span style={{ fontSize:28, fontWeight:700, color:"#f59e0b", letterSpacing:"-0.5px", fontFamily:"monospace" }}>
              {fmt$(total)}
            </span>
            <span style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em" }}>today</span>
            <span style={{ fontSize:11, color: pct > 85 ? "#ef4444" : "#4b5563", marginLeft:"auto" }}>
              {pct.toFixed(1)}%
            </span>
          </div>
          {allTime !== undefined && (
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
              <span style={{ fontSize:13, fontWeight:600, color:"#9ca3af", fontFamily:"monospace" }}>
                {fmt$(allTime)}
              </span>
              <span style={{ fontSize:10, color:"#4b5563", textTransform:"uppercase", letterSpacing:"0.08em" }}>all-time</span>
              <span style={{ fontSize:10, color:"#374151", marginLeft:"auto" }}>/ {fmt$(limit)} limit</span>
            </div>
          )}
        </div>

        {/* Budget bar */}
        <div style={{ height:5, borderRadius:3, background:"#1f2937", overflow:"hidden", marginBottom:10 }}>
          <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:3, transition:"width 0.6s ease" }} />
        </div>

        {/* Real OpenRouter balance — replaces dead /min estimate */}
        <div style={{ display:"flex", alignItems:"center", gap:8, background:balBg, border:`1px solid ${balBorder}`, borderRadius:7, padding:"7px 10px", marginBottom:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:balColor, flexShrink:0, boxShadow:`0 0 7px ${balColor}`, animation:"pdot 1.5s ease-in-out infinite" }} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"monospace", fontSize:20, fontWeight:700, color:balFlash ? "#22c55e" : balColor, transition:"color 0.4s", letterSpacing:"-0.5px", lineHeight:1 }}>
              {remaining !== undefined ? fmt$(remaining) : "—"}
            </div>
            <div style={{ fontSize:10, color:"#4b5563", marginTop:2 }}>remaining · openrouter{balLastUpdated ? " · ↻ " + Math.round((Date.now() - balLastUpdated.getTime()) / 1000) + "s" : ""}</div>
          </div>
          <a
            href="https://openrouter.ai/credits"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 9px", borderRadius:5, border:"1px solid #374151", background:"#0d1117", color:"#9ca3af", fontSize:10, fontWeight:700, letterSpacing:"0.06em", textDecoration:"none", flexShrink:0, cursor:"pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#f9fafb"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "#6b7280"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#9ca3af"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "#374151"; }}
            title="Add credits — manual payment only, opens openrouter.ai"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            TOP UP
          </a>
          <button
            type="button"
            onClick={async () => {
              setBalRefreshing(true);
              setBalFlash(false);
              await fetchBal();
              setBalRefreshing(false);
              setBalFlash(true);
              setTimeout(() => setBalFlash(false), 1500);
            }}
            title="Refresh balance now"
            style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:26, height:26, borderRadius:5, border:`1px solid ${balFlash ? "#22c55e" : "#374151"}`, background: balFlash ? "rgba(34,197,94,0.15)" : "#0d1117", color: balFlash ? "#22c55e" : "#9ca3af", cursor:"pointer", flexShrink:0, transition:"all 0.2s" }}
            onMouseEnter={e => { if(!balFlash){(e.currentTarget as HTMLButtonElement).style.color="#f9fafb";(e.currentTarget as HTMLButtonElement).style.borderColor="#6b7280";} }}
            onMouseLeave={e => { if(!balFlash){(e.currentTarget as HTMLButtonElement).style.color="#9ca3af";(e.currentTarget as HTMLButtonElement).style.borderColor="#374151";} }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: balRefreshing ? "spin 0.6s linear infinite" : "none" }}>
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
            </svg>
          </button>
        </div>

        {/* Active model badge */}
        <div style={{ background:"#0f1f3d", border:"1px solid #1e3a5f", borderRadius:7, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>Active Model</div>
            <div style={{ fontSize:13, fontWeight:700, color:"#60a5fa", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {activeLabel ?? "—"}
            </div>
            {model?.in_sync === false && (
              <div style={{ fontSize:10, color:"#ef4444", marginTop:2 }}>⚠ config out of sync</div>
            )}
          </div>
          <div style={{ fontSize:10, color:"#f59e0b", background:"#451a03", border:"1px solid #92400e", borderRadius:4, padding:"3px 7px", fontWeight:700, flexShrink:0 }}>● LIVE</div>
        </div>

        {costErr && <div style={{ fontSize:11, color:"#ef4444", marginTop:7 }}>⚠ {costErr}</div>}

        {/* ── Tokens Burned + Agents Online mini-tiles ── */}
        <div style={{ display:"flex", gap:6, marginTop:8 }}>
          {/* Tokens Burned */}
          <div style={{ flex:1, background:"#0d1117", border:"1px solid #1f2937", borderRadius:7, padding:"7px 10px" }}>
            <div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:3 }}>Tokens Burned</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#f59e0b", fontFamily:"monospace", lineHeight:1 }}>
              {(() => {
                const totalTok = (cost?.models ?? []).reduce((s,m) => s+(m.input_tokens??0)+(m.output_tokens??0), 0);
                if (totalTok >= 1_000_000) return (totalTok/1_000_000).toFixed(1)+"M";
                if (totalTok >= 1_000)     return (totalTok/1_000).toFixed(0)+"K";
                return totalTok > 0 ? String(totalTok) : (cost ? "0" : "—");
              })()}
            </div>
            <div style={{ fontSize:9, color:"#4b5563", marginTop:2 }}>
              {cost?.burn_rate?.cost_per_hour ? "~$"+(cost.burn_rate.cost_per_hour*24).toFixed(2)+" est today" : "all sessions"}
            </div>
          </div>
          {/* Agents Online */}
          <div style={{ flex:1, background:"#0d1117", border:"1px solid #1f2937", borderRadius:7, padding:"7px 10px" }}>
            <div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase" as const, letterSpacing:"0.1em", marginBottom:3 }}>Agents Online</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#22c55e", fontFamily:"monospace", lineHeight:1 }}>—</div>
            <div style={{ fontSize:9, color:"#4b5563", marginTop:2 }}>hermes workers</div>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE ── */}
      <div className="mr-scroll" style={{ flex:1, overflowY:"auto" }}>

        {/* Per-model spend — top 5 */}
        {cost?.models && cost.models.length > 0 && (
          <div style={{ padding:"10px 16px 6px" }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#4b5563", marginBottom:6 }}>Spend by model</div>
            {cost.models.slice(0, 5).map((m, i) => {
              const maxC = cost.models![0].cost;
              const bar  = maxC > 0 ? (m.cost / maxC) * 100 : 0;
              const cols = ["#f59e0b","#60a5fa","#a78bfa","#34d399","#fb7185"];
              const col  = cols[i % cols.length];
              const sn   = m.model.split("/").pop() ?? m.model;
              return (
                <div key={m.model} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, position:"relative", padding:"2px 0" }}>
                  <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${bar}%`, background:`${col}0c`, borderRadius:3, pointerEvents:"none" }} />
                  <div style={{ width:6, height:6, borderRadius:"50%", background:col, flexShrink:0 }} />
                  <span style={{ fontSize:11, color:"#9ca3af", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sn}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:col, fontFamily:"monospace", flexShrink:0 }}>{fmt$(m.cost)}</span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ height:1, background:"#1f2937", margin:"6px 0" }} />

        {/* Model Switcher */}
        <div style={{ padding:"6px 16px 16px" }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#4b5563", marginBottom:8 }}>Switch Model</div>

          {PROVIDERS.map(group => {
            const isOpen = collapsed[group.provider] !== true;
            return (
              <div key={group.provider} style={{ marginBottom:4, border:"1px solid #1f2937", borderRadius:7, overflow:"hidden" }}>
                <div className="mr-ph"
                  onClick={() => setCollapsed(c => ({ ...c, [group.provider]: isOpen }))}
                  style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:"#0d1117", userSelect:"none" }}
                >
                  <span style={{ width:8, height:8, borderRadius:"50%", background:group.color, flexShrink:0 }} />
                  <span style={{ fontSize:11, fontWeight:600, color:"#d1d5db", flex:1 }}>{group.provider}</span>
                  <span style={{ fontSize:10, color:"#4b5563" }}>{isOpen ? "▾" : "▸"}</span>
                </div>

                {isOpen && (
                  <div style={{ background:"#080c14" }}>
                    {group.models.map(m => {
                      const isAct  = m.id === activeId;
                      const isSw   = switching === m.id;
                      const didSw  = justSwitched === m.id;
                      const dotCol = TIER_DOT[m.tier];

                      return (
                        <div key={m.id} className="mr-row" style={{ padding:"7px 10px", borderTop:"1px solid #111827", background:isAct?"rgba(245,158,11,0.07)":"transparent", transition:"background 0.1s" }}>
                          {/* Row 1: dot + name + price + button */}
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:5, height:5, borderRadius:"50%", background:isAct?"#f59e0b":dotCol, opacity:isAct?1:0.55, flexShrink:0 }} />
                            <span style={{ fontSize:12, fontWeight:isAct?600:400, color:isAct?"#fcd34d":"#d1d5db", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {m.label}
                            </span>
                            <span style={{ fontSize:10, color:"#6b7280", flexShrink:0, fontFamily:"monospace" }}>${m.inputPer1M}</span>
                            {isAct ? (
                              <span style={{ fontSize:10, color:"#f59e0b", fontWeight:700, marginLeft:3, flexShrink:0 }}>✓</span>
                            ) : didSw ? (
                              <span style={{ fontSize:10, color:"#4ade80", fontWeight:700, marginLeft:3, flexShrink:0 }}>✓</span>
                            ) : (
                              <button className="mr-sb" disabled={!!switching} onClick={() => switchModel(m.id)}
                                style={{ fontSize:10, padding:"3px 8px", borderRadius:4, border:"1px solid #1e3a5f", background:"#0f172a", color:"#60a5fa", cursor:switching?"not-allowed":"pointer", fontWeight:600, flexShrink:0, display:"flex", alignItems:"center", gap:3, marginLeft:3 }}>
                                {isSw ? <><Spinner />…</> : "Use"}
                              </button>
                            )}
                          </div>
                          {/* Row 2: tier badge + strength tags */}
                          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:3, marginTop:4, marginLeft:11 }}>
                            <span style={{ fontSize:9, padding:"2px 7px", borderRadius:3, background:TIER_BG[m.tier], color:TIER_DOT[m.tier], border:`1px solid ${TIER_DOT[m.tier]}55`, letterSpacing:"0.07em", fontWeight:700, flexShrink:0 }}>
                              {TIER_LABEL[m.tier]}
                            </span>
                            {m.strengths.map(tag => (
                              <span key={tag} style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background:`${m.color}28`, color:`${m.color}ee`, border:`1px solid ${m.color}55`, letterSpacing:"0.02em", fontWeight:600 }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

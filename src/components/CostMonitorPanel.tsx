"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ─── Curated roster — validated against OpenRouter API ──────────────────────
type ModelEntry = {
  id: string;
  label: string;
  tier: "top" | "mid" | "budget";
  inputPer1M: number | null;
  outputPer1M: number | null;
};

type ProviderGroup = {
  provider: string;
  color: string;
  models: ModelEntry[];
};

const PROVIDERS: ProviderGroup[] = [
  {
    provider: "Anthropic", color: "#e07950",
    models: [
      { id: "anthropic/claude-opus-4.8",  label: "Claude Opus 4.8",   tier: "top",    inputPer1M: 15,  outputPer1M: 75  },
      { id: "anthropic/claude-sonnet-4.6",label: "Claude Sonnet 4.6", tier: "top",    inputPer1M: 3,   outputPer1M: 15  },
      { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5",  tier: "mid",    inputPer1M: 1,   outputPer1M: 5   },
    ],
  },
  {
    provider: "OpenAI", color: "#10a37f",
    models: [
      { id: "openai/gpt-5.5",      label: "GPT-5.5",       tier: "top",    inputPer1M: 10,   outputPer1M: 30   },
      { id: "openai/gpt-5.5-pro",  label: "GPT-5.5 Pro",   tier: "top",    inputPer1M: 30,   outputPer1M: 60   },
      { id: "openai/gpt-5.4",      label: "GPT-5.4",       tier: "mid",    inputPer1M: 5,    outputPer1M: 15   },
      { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini",  tier: "budget", inputPer1M: 0.40, outputPer1M: 1.60 },
    ],
  },
  {
    provider: "Google", color: "#4285f4",
    models: [
      { id: "google/gemini-3.1-pro-preview",label: "Gemini 3.1 Pro",        tier: "top",    inputPer1M: 7,     outputPer1M: 21    },
      { id: "google/gemini-3.5-flash",      label: "Gemini 3.5 Flash",      tier: "mid",    inputPer1M: 0.15,  outputPer1M: 0.60  },
      { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", tier: "budget", inputPer1M: 0.075, outputPer1M: 0.30  },
    ],
  },
  {
    provider: "xAI", color: "#1da1f2",
    models: [
      { id: "x-ai/grok-4.3", label: "Grok 4.3", tier: "top", inputPer1M: 3, outputPer1M: 15 },
    ],
  },
  {
    provider: "DeepSeek", color: "#7c6af7",
    models: [
      { id: "deepseek/deepseek-v4-pro",   label: "DeepSeek V4 Pro",   tier: "mid",    inputPer1M: 0.27, outputPer1M: 1.10 },
      { id: "deepseek/deepseek-v4-flash",  label: "DeepSeek V4 Flash", tier: "budget", inputPer1M: 0.07, outputPer1M: 0.28 },
    ],
  },
  {
    provider: "Meta", color: "#0867ff",
    models: [
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", tier: "budget", inputPer1M: 0.10, outputPer1M: 0.32 },
    ],
  },
];

const TIER_CONFIG = {
  top:    { label: "TOP TIER",    color: "#f59e0b", bg: "#451a03", border: "#92400e" },
  mid:    { label: "MID TIER",    color: "#60a5fa", bg: "#0f1f3d", border: "#1e3a5f" },
  budget: { label: "BUDGET TIER", color: "#4ade80", bg: "#052e16", border: "#166534" },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ModelSpend = { model: string; provider: string; sessions: number; cost: number; input_tokens: number; output_tokens: number; last_used: string };
type BurnRate   = { cost_per_min: number; cost_per_hour: number; cost_per_min_5m: number; window_minutes: number; last_updated: string };
type CostData   = { ok?: boolean; total?: number; limit?: number; timestamp?: string; over_limit?: boolean; models?: ModelSpend[]; burn_rate?: BurnRate };
type ModelData  = { model?: string; provider?: string; default_model?: string; in_sync?: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(n: number): string {
  if (n >= 100)  return `$${n.toFixed(2)}`;
  if (n >= 1)    return `$${n.toFixed(3)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}
function fmtBurnRate(cpm: number): string {
  if (cpm <= 0)  return "$0.000000/min";
  if (cpm >= 1)  return `$${cpm.toFixed(4)}/min`;
  return `$${cpm.toFixed(6)}/min`;
}
function shortModel(id: string): string {
  return id.split("/").pop() ?? id;
}

function Spinner() {
  return <span style={{ display:"inline-block", width:12, height:12, border:"2px solid rgba(255,255,255,0.2)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", verticalAlign:"middle" }} />;
}

// ─── BurnBar ─────────────────────────────────────────────────────────────────
function BurnBar({ spent, budget }: { spent: number; budget: number }) {
  const pct   = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const color = pct > 85 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#9ca3af", marginBottom:4 }}>
        <span>Monthly Budget</span>
        <span style={{ fontFamily:"monospace" }}>{fmt$(spent)} / {fmt$(budget)} ({pct.toFixed(1)}%)</span>
      </div>
      <div style={{ height:6, borderRadius:3, background:"#1f2937", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3, transition:"width 0.6s ease", boxShadow:`0 0 6px ${color}88` }} />
      </div>
    </div>
  );
}

// ─── BurnTicker ──────────────────────────────────────────────────────────────
function BurnTicker({ burnRate }: { burnRate: BurnRate | undefined }) {
  const [displayed, setDisplayed] = useState(0);
  const cpm = burnRate?.cost_per_min ?? 0;

  useEffect(() => {
    const tick = setInterval(() => {
      setDisplayed(prev => prev + cpm / 60);
    }, 1000);
    return () => clearInterval(tick);
  }, [cpm]);

  const isActive = cpm > 0;
  const dotColor = isActive ? "#22c55e" : "#374151";

  return (
    <div style={{ background:"#0a0f1a", border:`1px solid ${isActive ? "#166534" : "#1f2937"}`, borderRadius:10, padding:"10px 14px", marginTop:10, display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:dotColor, flexShrink:0, boxShadow:isActive ? `0 0 8px ${dotColor}` : "none", animation:isActive ? "pulse-dot 1.5s ease-in-out infinite" : "none" }} />
      <div style={{ flex:1 }}>
        <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:1 }}>Live Burn</div>
        <div style={{ fontFamily:"monospace", fontSize:20, fontWeight:700, color:isActive ? "#4ade80" : "#374151" }}>
          {fmtBurnRate(cpm)}
        </div>
        <div style={{ fontSize:10, color:"#4b5563", marginTop:1 }}>
          {burnRate?.cost_per_hour ? `$${burnRate.cost_per_hour.toFixed(4)}/hr · updated ${burnRate.last_updated ?? ""}` : "No activity in last 60 min"}
        </div>
      </div>
      <div style={{ textAlign:"right", fontFamily:"monospace", fontSize:11, color:"#6b7280" }}>
        <div style={{ fontSize:15, fontWeight:700, color:isActive ? "#fbbf24" : "#374151" }}>+{fmt$(displayed)}</div>
        <div style={{ fontSize:9, color:"#4b5563" }}>this session</div>
      </div>
    </div>
  );
}

// ─── SyncBadge ────────────────────────────────────────────────────────────────
function SyncBadge({ inSync }: { inSync: boolean | undefined }) {
  if (inSync === undefined) return null;
  return (
    <span style={{
      fontSize:10, padding:"2px 6px", borderRadius:4, fontWeight:700,
      background: inSync ? "#052e16" : "#450a0a",
      color:      inSync ? "#4ade80" : "#ef4444",
      border:     `1px solid ${inSync ? "#166534" : "#7f1d1d"}`,
      marginLeft: 8,
    }}>
      {inSync ? "✓ IN SYNC" : "⚠ OUT OF SYNC"}
    </span>
  );
}

// ─── ModelSpendTable ─────────────────────────────────────────────────────────
function ModelSpendTable({ models }: { models: ModelSpend[] }) {
  if (!models || models.length === 0) return <div style={{ fontSize:12, color:"#4b5563", padding:"8px 0" }}>No spend data yet</div>;
  const maxCost = models[0].cost;
  const barColors = ["#f59e0b","#60a5fa","#a78bfa","#34d399","#fb7185","#fbbf24","#38bdf8"];
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:3, marginTop:6 }}>
      {models.map((m, i) => {
        const pct   = maxCost > 0 ? (m.cost / maxCost) * 100 : 0;
        const color = barColors[i % barColors.length];
        return (
          <div key={m.model} style={{ background:"#0d1117", border:"1px solid #1f2937", borderRadius:7, padding:"7px 10px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", inset:0, width:`${pct}%`, background:`${color}0d`, borderRight:pct > 5 ? `1px solid ${color}33` : "none" }} />
            <div style={{ position:"relative", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:5, height:5, borderRadius:"50%", background:color, flexShrink:0, boxShadow:`0 0 5px ${color}` }} />
              <span style={{ fontSize:11, fontWeight:600, color:"#e5e7eb", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{shortModel(m.model)}</span>
              <span style={{ fontSize:10, color:"#6b7280", flexShrink:0 }}>{m.sessions}s</span>
              <span style={{ fontSize:12, fontWeight:700, color, flexShrink:0, fontFamily:"monospace" }}>{fmt$(m.cost)}</span>
            </div>
            <div style={{ position:"relative", marginTop:2, fontSize:10, color:"#4b5563" }}>
              {(m.input_tokens + m.output_tokens).toLocaleString()} tok · last: {m.last_used}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function CostMonitorPanel() {
  const [cost, setCost]         = useState<CostData | null>(null);
  const [costErr, setCostErr]   = useState<string | null>(null);
  const [model, setModel]       = useState<ModelData | null>(null);
  const [modelErr, setModelErr] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [justSwitched, setJustSwitched] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const fetchCost = useCallback(async () => {
    try {
      const r = await fetch("/api/cost");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCost(await r.json()); setCostErr(null);
    } catch (e) { setCostErr(String(e)); }
  }, []);

  const fetchModel = useCallback(async () => {
    try {
      const r = await fetch("/api/model");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setModel(await r.json()); setModelErr(null);
    } catch (e) { setModelErr(String(e)); }
  }, []);

  useEffect(() => {
    fetchCost(); fetchModel();
    const iv = setInterval(fetchCost, 15_000);
    return () => clearInterval(iv);
  }, [fetchCost, fetchModel]);

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
        // Re-fetch model to get in_sync field
        setTimeout(fetchModel, 500);
        setTimeout(() => setJustSwitched(null), 5000);
      }
    } catch (_) { /* ignore */ }
    setSwitching(null);
  };

  const activeId = model?.model ?? "";

  // Group models by tier for display
  const tierOrder: Array<"top" | "mid" | "budget"> = ["top", "mid", "budget"];

  return (
    <div style={{
      display:"flex", flexDirection:"column", height:"100%",
      background:"#111827", border:"1px solid #1f2937", borderRadius:12,
      fontFamily:"'Inter','SF Pro Display',system-ui,sans-serif", color:"#f9fafb",
      overflow:"hidden",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
        .mr-row:hover  { background: #1f2937 !important; }
        .mr-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(0.97); }
        .mr-ph:hover { background: #1a2235 !important; cursor: pointer; }
        .mr-scroll::-webkit-scrollbar { width: 4px; }
        .mr-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
        .mr-scroll::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* ══ PINNED: header + stats + active model ══ */}
      <div style={{ padding:"18px 18px 14px", flexShrink:0, borderBottom:"1px solid #1f2937" }}>

        {/* Title + timestamp */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:17, fontWeight:700, letterSpacing:"-0.3px" }}>🧭 Model Router</div>
          <div style={{ fontSize:10, color:"#6b7280", background:"#0d1117", border:"1px solid #1f2937", borderRadius:5, padding:"2px 7px" }}>
            {cost?.timestamp ?? "—"}
          </div>
        </div>

        {/* Total + burn */}
        {cost ? (
          <>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:4 }}>
              <span style={{ fontSize:34, fontWeight:700, color:"#f59e0b", letterSpacing:"-1px" }}>
                {fmt$(cost.total ?? 0)}
              </span>
              <span style={{ fontSize:12, color:"#9ca3af" }}>total spend</span>
            </div>
            {cost.limit && cost.limit > 0 ? <BurnBar spent={cost.total ?? 0} budget={cost.limit} /> : null}
            <BurnTicker burnRate={cost.burn_rate} />
          </>
        ) : costErr ? (
          <div style={{ color:"#ef4444", fontSize:12, marginBottom:8 }}>⚠ {costErr}</div>
        ) : (
          <div style={{ color:"#6b7280", fontSize:12, marginBottom:8 }}>Loading cost data…</div>
        )}

        {/* Active model — always visible */}
        <div style={{ background:"#0f1f3d", border:"1px solid #1e3a5f", borderRadius:9, padding:"9px 12px", marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, color:"#6b7280", marginBottom:2 }}>ACTIVE MODEL</div>
            {modelErr ? (
              <div style={{ color:"#ef4444", fontSize:11 }}>⚠ {modelErr}</div>
            ) : model ? (
              <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:6 }}>
                <span style={{ fontSize:15, fontWeight:700, color:"#60a5fa" }}>
                  {PROVIDERS.flatMap(p => p.models).find(m => m.id === activeId)?.label ?? activeId}
                </span>
                <span style={{ fontSize:10, background:"#1d4ed8", color:"#bfdbfe", borderRadius:4, padding:"1px 5px", fontWeight:600 }}>
                  {model.provider ?? "openrouter"}
                </span>
                <SyncBadge inSync={model.in_sync} />
              </div>
            ) : (
              <div style={{ color:"#6b7280", fontSize:12 }}>Loading…</div>
            )}
          </div>
          <div style={{ fontSize:10, color:"#f59e0b", background:"#451a03", border:"1px solid #92400e", borderRadius:5, padding:"3px 7px", fontWeight:700, flexShrink:0 }}>
            ● LIVE
          </div>
        </div>
      </div>

      {/* ══ SCROLLABLE: spend table + model switcher ══ */}
      <div className="mr-scroll" style={{ flex:1, overflowY:"auto", padding:"14px 18px 18px" }}>

        {/* Per-model spend */}
        {cost?.models && cost.models.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:"#6b7280", marginBottom:4, display:"flex", justifyContent:"space-between" }}>
              <span>Per-Model Spend</span>
              <span style={{ fontWeight:400, color:"#4b5563" }}>all time · top 15</span>
            </div>
            <ModelSpendTable models={cost.models} />
          </div>
        )}

        <div style={{ height:1, background:"#1f2937", marginBottom:14 }} />

        {/* Model switcher — grouped by provider, with tier badges */}
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", color:"#6b7280", marginBottom:10 }}>
          🤖 Model Switcher
        </div>

        {/* Tier legend */}
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {tierOrder.map(t => (
            <span key={t} style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4, background: TIER_CONFIG[t].bg, color: TIER_CONFIG[t].color, border:`1px solid ${TIER_CONFIG[t].border}` }}>
              {TIER_CONFIG[t].label}
            </span>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {PROVIDERS.map(group => {
            const isOpen = collapsed[group.provider] !== true;
            return (
              <div key={group.provider} style={{ border:"1px solid #1f2937", borderRadius:8, overflow:"hidden" }}>
                {/* Provider header */}
                <div className="mr-ph"
                  onClick={() => setCollapsed(c => ({ ...c, [group.provider]: isOpen }))}
                  style={{ display:"flex", alignItems:"center", padding:"7px 11px", background:"#0d1117", userSelect:"none" }}
                >
                  <span style={{ width:9, height:9, borderRadius:"50%", background:group.color, marginRight:8, flexShrink:0, boxShadow:`0 0 5px ${group.color}88` }} />
                  <span style={{ fontWeight:600, fontSize:12, color:"#e5e7eb", flex:1 }}>{group.provider}</span>
                  <span style={{ fontSize:10, color:"#4b5563" }}>{group.models.length}m</span>
                  <span style={{ marginLeft:6, color:"#4b5563", fontSize:11 }}>{isOpen ? "▾" : "▸"}</span>
                </div>

                {isOpen && (
                  <div style={{ background:"#0a0f1a" }}>
                    {group.models.map(m => {
                      const isActive    = m.id === activeId;
                      const isSwitching = switching === m.id;
                      const didSwitch   = justSwitched === m.id;
                      const tc          = TIER_CONFIG[m.tier];
                      return (
                        <div key={m.id} className="mr-row" style={{ display:"flex", alignItems:"center", padding:"7px 11px", borderTop:"1px solid #111827", background:isActive ? "#1a1505" : "transparent", transition:"background 0.15s" }}>
                          {/* Active dot */}
                          <div style={{ width:4, height:4, borderRadius:"50%", background:isActive ? "#f59e0b" : "transparent", marginRight:9, flexShrink:0 }} />
                          {/* Name */}
                          <span style={{ fontSize:12, fontWeight:isActive ? 600 : 400, color:isActive ? "#fcd34d" : "#d1d5db", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {m.label}
                          </span>
                          {/* Tier badge */}
                          <span style={{ fontSize:9, padding:"1px 5px", borderRadius:3, fontWeight:700, marginRight:6, background:tc.bg, color:tc.color, border:`1px solid ${tc.border}`, flexShrink:0 }}>
                            {m.tier.toUpperCase()}
                          </span>
                          {/* Price */}
                          <span style={{ fontSize:10, padding:"1px 5px", borderRadius:3, fontWeight:600, marginRight:6, background:"#1c1917", color:"#9ca3af", border:"1px solid #292524", flexShrink:0 }}>
                            ${m.inputPer1M}
                          </span>
                          {/* Switch button */}
                          {isActive ? (
                            <span style={{ fontSize:10, color:"#f59e0b", fontWeight:700, minWidth:54, textAlign:"center" }}>✓ Active</span>
                          ) : didSwitch ? (
                            <span style={{ fontSize:10, color:"#4ade80", fontWeight:700, minWidth:54, textAlign:"center" }}>✓ Done</span>
                          ) : (
                            <button className="mr-btn" disabled={!!switching} onClick={() => switchModel(m.id)}
                              style={{ fontSize:10, padding:"3px 9px", borderRadius:4, border:"1px solid #1e3a5f", background:switching ? "#0d1117" : "#0f172a", color:switching ? "#4b5563" : "#60a5fa", cursor:switching ? "not-allowed" : "pointer", fontWeight:600, minWidth:54, transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:3 }}>
                              {isSwitching ? <><Spinner /> …</> : "Use"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop:10, fontSize:10, color:"#374151", textAlign:"right" }}>
          Polls every 15s · burn ticker 1s · dual-config write on every switch
        </div>
      </div>
    </div>
  );
}

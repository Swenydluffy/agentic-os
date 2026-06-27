"use client";
import { useEffect, useState } from "react";

// ─── Live data shapes ─────────────────────────────────────────────────────────
type CostData = {
  total?: number;
  burn_rate?: { cost_per_hour?: number; cost_per_min?: number };
  models?: Array<{ input_tokens: number; output_tokens: number }>;
};

type RufloData = {
  online?: boolean;
  activeAgents?: number;
  totalAgents?: number;
  agents?: Array<{ status: string }>;
};

function fmt$(n: number) {
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 1)   return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ─── Single metric tile ───────────────────────────────────────────────────────
function Tile({
  icon, label, value, sub, accent, loading,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  loading?: boolean;
}) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 14px",
      background: `${accent}0a`,
      border: `1px solid ${accent}25`,
      borderRadius: 8,
      minWidth: 0,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 1 }}>
          {label}
        </div>
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: loading ? "#374151" : accent,
          fontFamily: "monospace",
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}>
          {loading ? "—" : value}
        </div>
        {sub && (
          <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WorkToolsStrip — compact tool tiles above MetricBar ────────────────────
const WORK_TOOLS = [
  { id: "kanban",    icon: "📋", label: "Kanban"   },
  { id: "notebook",  icon: "📓", label: "Notebook" },
  { id: "paperclip", icon: "📎", label: "Paperclip"},
  { id: "neurosync", icon: "🔬", label: "NeuroSync" },
  { id: "obsidian",  icon: "🔮", label: "Obsidian" },
  { id: "logs",      icon: "📜", label: "Logs"     },
  { id: "secrets",   icon: "🔑", label: "Vault"    },
  { id: "security",  icon: "📹", label: "Cameras"  },
];

export function WorkToolsStrip({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "6px 12px",
      borderBottom: "1px solid #1f2937",
      background: "#06090f",
      flexShrink: 0,
      overflowX: "auto",
    }}>
      <span style={{ fontSize: 9, color: "#374151", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", flexShrink: 0, marginRight: 4 }}>
        TOOLS
      </span>
      {WORK_TOOLS.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onNavigate(t.id)}
          title={t.label}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "3px 9px", borderRadius: 6,
            border: "1px solid #1f2937", background: "#0d1117",
            color: "#9ca3af", fontSize: 11, fontWeight: 500,
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            transition: "all 0.12s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#374151";
            (e.currentTarget as HTMLButtonElement).style.color = "#f9fafb";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#1f2937";
            (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af";
          }}
        >
          <span style={{ fontSize: 13 }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── MetricBar — 2 tiles only ──────────────────────────────────────────────────
export function MetricBar() {
  const [cost, setCost]   = useState<CostData | null>(null);
  const [ruflo, setRuflo] = useState<RufloData | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchAll() {
      // Cost (tokens + spend)
      try {
        const r = await fetch("/api/cost");
        if (r.ok && mounted) setCost(await r.json());
      } catch { /* silent */ }

      // Ruflo (agents online)
      try {
        const r = await fetch("/api/ruflo", { cache: "no-store" });
        if (r.ok && mounted) setRuflo(await r.json());
      } catch { /* silent */ }
    }

    void fetchAll();
    const iv = setInterval(fetchAll, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  // ── Tokens Burned (24h estimate from burn rate) ──
  const cph       = cost?.burn_rate?.cost_per_hour ?? 0;
  const est24hCost = cph * 24;
  // Total tokens from all models (all-time, from cost data)
  const totalTok  = (cost?.models ?? []).reduce(
    (sum, m) => sum + (m.input_tokens ?? 0) + (m.output_tokens ?? 0), 0
  );
  const tokenDisplay = totalTok > 0 ? fmtNum(totalTok) : (cost ? "0" : "—");
  const tokenSub = cph > 0
    ? `~${fmt$(est24hCost)} est. today · ${fmt$(cost?.total ?? 0)} total`
    : cost?.total ? `${fmt$(cost.total)} all-time` : "loading…";

  // ── Agents Online ──
  const agents = ruflo?.agents ?? [];
  const running = agents.filter(a => a.status === "running").length;
  const total   = ruflo?.totalAgents ?? agents.length ?? 0;
  const agentDisplay = ruflo
    ? `${ruflo.activeAgents ?? running}/${total}`
    : "—";
  const agentSub = ruflo?.online === false
    ? "Ruflo offline"
    : ruflo
    ? `${agents.filter(a => a.status === "idle").length} idle · ${agents.filter(a => a.status === "error").length} error`
    : "loading…";

  return (
    <div style={{
      display: "flex",
      gap: 8,
      padding: "8px 12px",
      borderBottom: "1px solid #1f2937",
      flexShrink: 0,
      background: "#080c14",
    }}>
      <Tile
        icon="🔥"
        label="Tokens Burned"
        value={tokenDisplay}
        sub={tokenSub}
        accent="#f59e0b"
        loading={!cost}
      />
      <Tile
        icon="🤖"
        label="Agents Online"
        value={agentDisplay}
        sub={agentSub}
        accent="#22c55e"
        loading={!ruflo}
      />
    </div>
  );
}

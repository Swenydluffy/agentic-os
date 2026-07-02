"use client";

// ─── WorkToolsStrip — compact tool tiles ─────────────────────────────────────
const WORK_TOOLS = [
  { id: "kanban",      icon: "📋", label: "Kanban"    },
  { id: "notebook",    icon: "📓", label: "Notebook"  },
  { id: "paperclip",   icon: "📎", label: "Paperclip" },
  { id: "neurosync",   icon: "🔬", label: "NeuroSync"  },
  { id: "obsidian",    icon: "🔮", label: "Obsidian"  },
  { id: "logs",        icon: "📜", label: "Logs"      },
  { id: "secrets",     icon: "🔑", label: "Vault"     },
  { id: "security",    icon: "📹", label: "Cameras"   },
  { id: "learnhermes", icon: "🎓", label: "Learn"     },
  { id: "mindinsurance", icon: "🧠", label: "Mind"      },
{ id: "notes",        icon: "📝", label: "Notes"     },
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
      overflowX: "auto" as const,
    }}>
      <span style={{
        fontSize: 9, color: "#374151", fontWeight: 700,
        letterSpacing: "0.15em", textTransform: "uppercase" as const,
        flexShrink: 0, marginRight: 4,
      }}>
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
            cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0,
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

// MetricBar is removed — Tokens Burned and Agents Online moved into ModelRouterRail.
// This file now only exports WorkToolsStrip.
export function MetricBar() { return null; }

"use client";

import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

/* ------------------------------------------------------------------ */
/*  Nav data — single LIFE section, 12 items only                      */
/* ------------------------------------------------------------------ */

const NAV_ITEMS: NavItem[] = [
  { id: "calendar",      label: "Calendar",          icon: "📅" },
  { id: "family",        label: "Family",            icon: "👨‍👩‍👧" },
  { id: "goals",         label: "Goals",             icon: "🎯" },
  { id: "journal",       label: "Journal",           icon: "📖" },
  { id: "entertainment", label: "Entertainment",     icon: "🎬" },
  { id: "music",         label: "Music",             icon: "🎵" },
  { id: "gratitude",     label: "Gratitude Journal", icon: "🙏" },
  { id: "photos",        label: "Photos",            icon: "🖼️" },
  { id: "security",      label: "Security Cameras",  icon: "📹" },
];

const ACCENT = "#10b981";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const isLifeItem = NAV_ITEMS.some(i => i.id === activeView);
  const borderColor = isLifeItem ? `${ACCENT}33` : "rgba(59,130,246,0.2)";

  return (
    <nav
      className="flex flex-col h-full overflow-y-auto"
      style={{
        width: 220,
        background: "#0f1117",
        borderRight: `2px solid ${borderColor}`,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-4 py-4 border-b shrink-0"
        style={{ borderColor: "#1e2330" }}
      >
        <span className="text-xl">🛰️</span>
        <span
          className="font-bold tracking-widest text-xs uppercase"
          style={{ color: isLifeItem ? ACCENT : "#3b82f6" }}
        >
          Mission Control
        </span>
      </div>

      {/* Dashboard shortcut */}
      <button
        onClick={() => onViewChange("mission")}
        className="flex items-center gap-2 px-3 py-2 w-full text-left text-xs transition shrink-0"
        style={{
          borderLeft: activeView === "mission" ? `3px solid #3b82f6` : "3px solid transparent",
          background: activeView === "mission" ? "rgba(59,130,246,0.08)" : "transparent",
          color: activeView === "mission" ? "#3b82f6" : "#64748b",
        }}
      >
        <span>⚡</span>
        <span className="font-bold tracking-widest">COMMAND</span>
      </button>

      {/* Divider */}
      <div className="mx-3 my-1 border-t" style={{ borderColor: "#1e2330" }} />

      {/* LIFE section header */}
      <div className="px-3 py-2 shrink-0">
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#4b5563" }}>
          🌱 LIFE
        </span>
      </div>

      {/* Life items */}
      <div className="flex-1 pb-4">
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-left text-xs transition-all"
              style={{
                background: active ? `${ACCENT}18` : "transparent",
                borderLeft: active ? `3px solid ${ACCENT}` : "3px solid transparent",
                color: active ? ACCENT : "#94a3b8",
                marginLeft: 0,
              }}
            >
              <span>{item.icon}</span>
              <span className={cn("truncate", active && "font-medium")}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

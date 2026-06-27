"use client";
import { useEffect, useRef, useState } from "react";

interface AttachMenuProps {
  onFile: () => void;
  onPaste: () => void;
  onSearch: () => void;
  accent?: string;
}

export function AttachMenu({ onFile, onPaste, onSearch, accent = "#60a5fa" }: AttachMenuProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!popRef.current?.contains(e.target as Node) &&
          !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const items = [
    { icon: "📎", label: "Files & Photos",    fn: onFile   },
    { icon: "📋", label: "Paste from Clipboard",  fn: onPaste  },
    { icon: "🔍", label: "Web Search",         fn: onSearch },
  ];

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Attach / web search"
        style={{
          width: 36, height: 44,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
          background: open ? "rgba(96,165,250,0.1)" : "rgba(0,0,0,0.3)",
          color: open ? accent : "#6b7280",
          cursor: "pointer", fontSize: 20, lineHeight: 1,
          transition: "all 0.15s", fontWeight: 400,
        }}
      >
        +
      </button>

      {open && (
        <div
          ref={popRef}
          style={{
            position: "absolute", bottom: "calc(100% + 8px)", left: 0,
            background: "#111827", border: "1px solid #1f2937",
            borderRadius: 10, padding: "4px 0", width: 188, zIndex: 200,
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          }}
        >
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.fn(); }}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px", background: "none", border: "none",
                cursor: "pointer", fontSize: 13, color: "#d1d5db",
                textAlign: "left", transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1f2937")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

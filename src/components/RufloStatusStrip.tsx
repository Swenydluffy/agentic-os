"use client";
import { useEffect, useState } from "react";

interface RufloStrip {
  online: boolean;
  activeAgents: number;
  totalAgents: number;
  agents?: Array<{ status: string }>;
  error?: string;
}

export function RufloStatusStrip() {
  const [data, setData] = useState<RufloStrip | null>(null);

  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const r = await fetch("/api/ruflo", { cache: "no-store" });
        const d = await r.json() as RufloStrip;
        if (mounted) setData(d);
      } catch {
        if (mounted) setData({ online: false, activeAgents: 0, totalAgents: 0, error: "unreachable" });
      }
    }
    void poll();
    const iv = setInterval(poll, 10_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (!data) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background:"#0d1117", border:"1px solid #1f2937", borderRadius:6, fontSize:10, color:"#4b5563", fontFamily:"monospace" }}>
        <span style={{ width:5, height:5, borderRadius:"50%", background:"#374151", flexShrink:0 }} />
        Ruflo…
      </div>
    );
  }

  const agents = data.agents ?? [];
  const active  = agents.filter(a => a.status === "running").length;
  const idle    = agents.filter(a => a.status === "idle").length;
  const errors  = agents.filter(a => a.status === "error").length;
  const total   = data.totalAgents || agents.length;

  const dotColor = !data.online ? "#ef4444" : active > 0 ? "#22c55e" : "#f59e0b";

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8,
      padding:"4px 10px",
      background:"#0d1117",
      border:`1px solid ${dotColor}30`,
      borderRadius:6,
      fontSize:10,
      fontFamily:"monospace",
      color:"#9ca3af",
      flexShrink:0,
    }}>
      <div style={{ width:5, height:5, borderRadius:"50%", background:dotColor, flexShrink:0, boxShadow:data.online?`0 0 5px ${dotColor}`:"none" }} />
      {data.online ? (
        <>
          <span style={{ color:"#d1d5db" }}>{total} agent{total !== 1 ? "s" : ""}</span>
          {idle > 0 && <span style={{ color:"#6b7280" }}>· {idle} idle</span>}
          {errors > 0 && <span style={{ color:"#ef4444" }}>· {errors} error</span>}
        </>
      ) : (
        <span style={{ color:"#ef4444" }}>Ruflo offline</span>
      )}
    </div>
  );
}

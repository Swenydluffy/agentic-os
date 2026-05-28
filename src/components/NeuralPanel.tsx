"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Brain } from "lucide-react";

type Node = { id: string; x: number; y: number; r: number; color: string; pulse: number };
type Edge = { from: number; to: number };

const COLORS = ["#22e2ff", "#9b6bff", "#ff3ec1", "#b9ff66"];

function generate(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.2);
    const ring = i % 3 === 0 ? 90 : i % 2 === 0 ? 60 : 30;
    nodes.push({
      id: `n${i}`,
      x: 150 + Math.cos(angle) * ring,
      y: 150 + Math.sin(angle) * ring,
      r: 2 + (i % 4),
      color: COLORS[i % COLORS.length],
      pulse: Math.random(),
    });
  }
  // central
  nodes.push({ id: "core", x: 150, y: 150, r: 6, color: "#ffffff", pulse: 0 });

  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ from: i, to: nodes.length - 1 });
    if (i > 0 && i % 2 === 0) edges.push({ from: i, to: (i - 1) });
    if (i > 1 && i % 3 === 0) edges.push({ from: i, to: (i - 2) });
  }
  return { nodes, edges };
}

export function NeuralPanel() {
  const { nodes, edges } = useMemo(generate, []);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-[var(--color-violet)]" />
          <h2 className="font-display text-base font-semibold tracking-wide text-white">
            Neural Mesh
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-faint)]">
          inter-agent · consensus
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(155,107,255,0.18), transparent 65%)",
          }}
        />
        <svg viewBox="0 0 300 300" className="relative h-full w-full">
          <defs>
            {nodes.map((n) => (
              <radialGradient id={`g-${n.id}`} key={n.id}>
                <stop offset="0%" stopColor={n.color} stopOpacity="1" />
                <stop offset="100%" stopColor={n.color} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* concentric rings */}
          {[30, 60, 90, 120].map((r) => (
            <circle
              key={r}
              cx={150}
              cy={150}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="2 4"
            />
          ))}

          {/* edges */}
          {edges.map((e, i) => {
            const a = nodes[e.from];
            const b = nodes[e.to];
            const active = (i + tick) % 7 === 0;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={active ? a.color : "rgba(255,255,255,0.08)"}
                strokeWidth={active ? 1.4 : 0.6}
                opacity={active ? 0.9 : 0.6}
                style={active ? { filter: `drop-shadow(0 0 4px ${a.color})` } : undefined}
              />
            );
          })}

          {/* nodes */}
          {nodes.map((n, i) => {
            const live = (i + tick) % 4 === 0;
            return (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={n.r * 4} fill={`url(#g-${n.id})`} opacity={live ? 0.7 : 0.3} />
                <motion.circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={n.color}
                  animate={{ scale: live ? [1, 1.4, 1] : 1 }}
                  transition={{ duration: 1.0 }}
                  style={{ transformOrigin: `${n.x}px ${n.y}px`, filter: `drop-shadow(0 0 6px ${n.color})` }}
                />
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute bottom-3 left-5 right-5 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
          <span>{nodes.length - 1} nodes</span>
          <span>{edges.length} edges</span>
          <span>{(Math.sin(tick) * 4 + 87).toFixed(1)}% coherence</span>
        </div>
      </div>
    </div>
  );
}

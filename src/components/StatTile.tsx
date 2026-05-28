"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

type Accent = "cyan" | "violet" | "magenta" | "lime" | "amber";

const ACCENT: Record<Accent, { color: string; bg: string }> = {
  cyan: { color: "#22e2ff", bg: "rgba(34,226,255,0.12)" },
  violet: { color: "#9b6bff", bg: "rgba(155,107,255,0.12)" },
  magenta: { color: "#ff3ec1", bg: "rgba(255,62,193,0.12)" },
  lime: { color: "#b9ff66", bg: "rgba(185,255,102,0.12)" },
  amber: { color: "#ffb547", bg: "rgba(255,181,71,0.12)" },
};

export function StatTile({
  label,
  value,
  suffix,
  delta,
  spark,
  accent = "cyan",
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  delta?: number;
  spark: number[];
  accent?: Accent;
  icon?: React.ReactNode;
}) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 70, damping: 22, mass: 0.6 });
  const display = useTransform(spring, (v) =>
    Math.round(v).toLocaleString("en-US")
  );
  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  const a = ACCENT[accent];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="panel panel-hover relative overflow-hidden p-5"
    >
      <div className="sweep" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ background: a.bg, color: a.color }}
            >
              {icon}
            </span>
            <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--color-ink-faint)]">
              {label}
            </p>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <motion.span className="font-display text-3xl font-semibold tabular text-white">
              {display}
            </motion.span>
            {suffix && (
              <span className="text-sm font-medium text-[var(--color-ink-dim)]">
                {suffix}
              </span>
            )}
          </div>
          {typeof delta === "number" && (
            <p className="mt-1 font-mono text-[11px] tabular" style={{ color: delta >= 0 ? "var(--color-lime)" : "var(--color-danger)" }}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% · 24h
            </p>
          )}
        </div>

        <Sparkline data={spark} color={a.color} />
      </div>
    </motion.div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 96;
  const h = 40;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((d, i) => {
    const x = i * step;
    const y = h - ((d - min) / range) * h;
    return [x, y];
  });
  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#grad-${color})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: [0.2, 0.7, 0.2, 1] }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2.5}
        fill={color}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

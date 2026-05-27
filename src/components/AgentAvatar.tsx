"use client";

import { cn } from "@/lib/utils";
import type { AgentStatus, AgentSystem } from "@/lib/agents";

const STATUS_COLOR: Record<AgentStatus, string> = {
  online: "#b9ff66",
  thinking: "#22e2ff",
  idle: "#8b94b3",
  offline: "#4d557a",
  error: "#ff5577",
};

/**
 * A distinct, brand-like avatar for each agent: a gradient squircle with the
 * agent's glyph, a soft colored glow, and an optional presence dot. Used in the
 * grid, the conversation rail, chat headers, and individual messages so every
 * agent is instantly recognizable.
 */
export function AgentAvatar({
  agent,
  size = 40,
  status,
  glow = true,
  active = false,
  className,
}: {
  agent: AgentSystem;
  size?: number;
  status?: AgentStatus;
  glow?: boolean;
  active?: boolean;
  className?: string;
}) {
  const Icon = agent.icon;
  const [from, to] = agent.gradient;
  const radius = Math.max(8, Math.round(size * 0.3));
  const dot = Math.max(8, Math.round(size * 0.26));

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {glow && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 blur-md transition-opacity duration-500",
            active ? "opacity-80" : "opacity-45"
          )}
          style={{
            borderRadius: radius,
            background: `linear-gradient(135deg, ${from}, ${to})`,
          }}
        />
      )}
      <span
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        style={{
          borderRadius: radius,
          background: `linear-gradient(135deg, ${from}, ${to})`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -8px 14px rgba(0,0,0,0.25)`,
        }}
      >
        {/* glossy top-light sheen */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 30% 0%, rgba(255,255,255,0.45), transparent 55%)",
            borderRadius: radius,
          }}
        />
        <Icon
          size={Math.round(size * 0.5)}
          strokeWidth={2.1}
          className="relative text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        />
      </span>

      {status && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#070a13]"
          style={{
            width: dot,
            height: dot,
            background: STATUS_COLOR[status],
            boxShadow: `0 0 8px ${STATUS_COLOR[status]}`,
          }}
        >
          {status === "thinking" && (
            <span
              className="absolute inset-0 animate-ping rounded-full"
              style={{ background: STATUS_COLOR[status], opacity: 0.6 }}
            />
          )}
        </span>
      )}
    </span>
  );
}

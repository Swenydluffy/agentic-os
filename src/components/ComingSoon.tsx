import type { ComponentType } from "react";

type Icon = ComponentType<{ size?: number | string; className?: string }>;

/** A clear placeholder panel for modules that aren't built yet. */
export function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: Icon;
}) {
  return (
    <div className="panel mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-5 px-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)]">
        <Icon size={28} />
      </span>
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-ink-faint)]">Coming soon</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-white">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-ink-dim)]">{description}</p>
      </div>
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
        Not yet available
      </span>
    </div>
  );
}

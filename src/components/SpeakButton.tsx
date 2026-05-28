"use client";

import { Volume2, VolumeX, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpeechController } from "@/lib/useSpeechSynthesis";

/** Per-message speaker button: click to read the reply aloud, click again to stop. */
export function SpeakButton({
  id,
  text,
  controller,
  accent,
}: {
  id: string;
  text: string;
  controller: SpeechController;
  accent?: string;
}) {
  if (!controller.isSupported || !text.trim()) return null;
  const active = controller.speakingId === id;
  return (
    <button
      type="button"
      onClick={() => (active ? controller.stop() : controller.speak(id, text))}
      aria-label={active ? "Stop reading" : "Read aloud"}
      aria-pressed={active}
      title={active ? "Stop" : "Read aloud"}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-ink-faint)] transition hover:bg-white/5 hover:text-white",
      )}
      style={active ? { color: accent ?? "var(--color-cyan)" } : undefined}
    >
      {active ? <Square size={11} className="fill-current" /> : <Volume2 size={13} />}
    </button>
  );
}

/** Header toggle: when on, every reply is read aloud automatically. */
export function AutoSpeakToggle({
  enabled,
  onToggle,
  supported,
}: {
  enabled: boolean;
  onToggle: () => void;
  supported: boolean;
}) {
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={enabled ? "Auto-speak replies on — click to mute" : "Auto-speak replies off — click to enable"}
      aria-pressed={enabled}
      title={enabled ? "Auto-speak: ON (click to mute)" : "Auto-speak: OFF (click to enable)"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border transition",
        enabled
          ? "border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]"
          : "border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)] hover:bg-white/[0.07] hover:text-white",
      )}
    >
      {enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
    </button>
  );
}

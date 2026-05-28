"use client";

import { Mic } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { cn } from "@/lib/utils";

/** Imperative handle parents use after committing the input (e.g. on send). */
export type MicHandle = {
  /** Stop dictation and forget the accumulated transcript so a late
   *  buffered `onresult` can't replay just-sent text back into the field. */
  reset: () => void;
};

type MicButtonProps = {
  /** Current input value — captured as the base text when dictation begins. */
  value: string;
  /** Receives the input value updated with live transcription. */
  onValueChange: (value: string) => void;
  /** Extra classes for the button (e.g. to tweak sizing per composer). */
  className?: string;
  /** Icon size in px. */
  iconSize?: number;
};

/**
 * Voice-dictation toggle for a chat composer. Renders nothing when the browser
 * lacks the Web Speech API, so callers can drop it next to any input freely.
 */
export const MicButton = forwardRef<MicHandle, MicButtonProps>(function MicButton(
  { value, onValueChange, className, iconSize = 17 },
  ref,
) {
  // Text present when dictation started; transcription is appended onto it.
  const baseRef = useRef("");

  const { isSupported, isListening, start, stop, reset } = useSpeechRecognition({
    onTranscript: (transcript) => {
      const base = baseRef.current;
      if (!transcript) {
        onValueChange(base);
        return;
      }
      const sep = base && !/\s$/.test(base) ? " " : "";
      onValueChange(base + sep + transcript);
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        baseRef.current = "";
        reset();
      },
    }),
    [reset],
  );

  if (!isSupported) return null;

  function toggle() {
    if (isListening) {
      stop();
    } else {
      baseRef.current = value;
      start();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isListening ? "Stop dictation" : "Dictate message"}
      aria-pressed={isListening}
      className={cn(
        "flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border transition",
        isListening
          ? "mic-listening border-[var(--color-danger)]/50 bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
          : "border-white/10 bg-white/[0.03] text-[var(--color-ink-dim)] hover:bg-white/[0.07] hover:text-white",
        className,
      )}
    >
      <Mic size={iconSize} />
    </button>
  );
});

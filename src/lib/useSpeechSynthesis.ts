"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeechController {
  /** Whether the browser can play audio. */
  isSupported: boolean;
  /** Id of the message currently being spoken, or null. */
  speakingId: string | null;
  /** Speak `text`, attributing playback to `id`. Cancels anything in progress. */
  speak: (id: string, text: string) => void;
  /** Stop any current playback (and any in-flight synthesis request). */
  stop: () => void;
}

/** Light cleanup so Markdown reads naturally aloud. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ". code block. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Speech playback backed by Microsoft Edge's Neural TTS (en-US-ChristopherNeural)
 * via the server route /api/tts. The route returns MP3 bytes which we play
 * through an HTMLAudioElement — same `SpeechController` shape as before so
 * `SpeakButton` / `AutoSpeakToggle` / panel call-sites stay unchanged.
 */
export function useSpeechSynthesis(): SpeechController {
  const [isSupported, setIsSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** Monotonic request counter so late responses for cancelled requests are ignored. */
  const requestSeqRef = useRef(0);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && typeof Audio !== "undefined");
  }, []);

  const teardownAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    }
    const url = objectUrlRef.current;
    if (url) {
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    requestSeqRef.current += 1; // invalidate any pending request
    abortRef.current?.abort();
    abortRef.current = null;
    teardownAudio();
    setSpeakingId(null);
  }, [teardownAudio]);

  const speak = useCallback(
    (id: string, text: string) => {
      const cleaned = cleanForSpeech(text);
      if (!cleaned) return;

      // Cancel anything currently playing or in flight.
      abortRef.current?.abort();
      abortRef.current = null;
      teardownAudio();

      const mySeq = ++requestSeqRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setSpeakingId(id);

      void (async () => {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleaned }),
            signal: controller.signal,
          });
          if (mySeq !== requestSeqRef.current) return; // stale (stop or new speak)
          if (!res.ok) {
            const detail = await res
              .json()
              .then((d: { error?: string } | null) => d?.error ?? `HTTP ${res.status}`)
              .catch(() => `HTTP ${res.status}`);
            throw new Error(detail);
          }
          const blob = await res.blob();
          if (mySeq !== requestSeqRef.current) return;

          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            if (mySeq !== requestSeqRef.current) return;
            teardownAudio();
            setSpeakingId((current) => (current === id ? null : current));
          };
          audio.onerror = () => {
            teardownAudio();
            setSpeakingId((current) => (current === id ? null : current));
          };
          try {
            await audio.play();
          } catch (playErr) {
            // Likely an autoplay-policy rejection — fall back gracefully.
            console.warn("[tts] play blocked or failed:", playErr);
            teardownAudio();
            setSpeakingId((current) => (current === id ? null : current));
          }
        } catch (err: unknown) {
          if ((err as Error).name === "AbortError") return;
          console.error("[tts] synthesis failed:", err instanceof Error ? err.message : err);
          setSpeakingId((current) => (current === id ? null : current));
        }
      })();
    },
    [teardownAudio],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      teardownAudio();
    };
  }, [teardownAudio]);

  return { isSupported, speakingId, speak, stop };
}

const AUTO_SPEAK_KEY = "agentic-os:tts-autoplay";

/** Persisted "auto-speak every reply" preference, shared across panels. */
export function useAutoSpeak(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(AUTO_SPEAK_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback((value: boolean) => {
    setEnabled(value);
    try {
      localStorage.setItem(AUTO_SPEAK_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return [enabled, update];
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SpeechController {
  /** Whether the browser exposes the Web Speech Synthesis API. */
  isSupported: boolean;
  /** Id of the message currently being spoken, or null. */
  speakingId: string | null;
  /** Speak `text`, attributing playback to `id` (cancels anything in progress). */
  speak: (id: string, text: string) => void;
  /** Stop any current playback. */
  stop: () => void;
}

/** Light cleanup so Markdown reads naturally aloud (drops backticks, asterisks, headings, links). */
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

/** React wrapper around window.speechSynthesis. No network/API key required. */
export function useSpeechSynthesis(): SpeechController {
  const [isSupported, setIsSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeakingId(null);
  }, []);

  const speak = useCallback((id: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const content = cleanForSpeech(text);
    if (!content) return;

    const synth = window.speechSynthesis;
    synth.cancel(); // clear any in-progress / queued utterance first

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
    utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current));

    utteranceRef.current = utterance;
    setSpeakingId(id);
    synth.speak(utterance);
  }, []);

  // Stop speech if the component using this hook unmounts.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

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

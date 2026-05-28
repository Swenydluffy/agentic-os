import { useCallback, useEffect, useRef, useState } from "react";

/** Resolve the (vendor-prefixed) SpeechRecognition constructor, or null when unsupported / SSR. */
function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

type UseSpeechRecognitionOptions = {
  /**
   * Fired as words are recognized. `transcript` is the full utterance captured
   * since the most recent `start()` — finalized phrases plus the live interim tail.
   */
  onTranscript: (transcript: string) => void;
  /** BCP-47 language tag. Defaults to the document language, then "en-US". */
  lang?: string;
};

type UseSpeechRecognition = {
  /** Whether the browser exposes the Web Speech API. `false` during SSR. */
  isSupported: boolean;
  /** Whether recognition is currently active. */
  isListening: boolean;
  start: () => void;
  stop: () => void;
};

/**
 * Thin React wrapper around the browser's built-in SpeechRecognition.
 * Streams live transcription to `onTranscript`; no network/API key required.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions
): UseSpeechRecognition {
  const { onTranscript, lang } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Latest callback, so the recognizer's handlers never need re-binding.
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  // Accumulated finalized text for the current listening session.
  const finalRef = useRef("");

  // Support detection is client-only — `window` is undefined during SSR.
  useEffect(() => {
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      lang ||
      (typeof document !== "undefined" ? document.documentElement.lang : "") ||
      "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalRef.current += text;
        } else {
          interim += text;
        }
      }
      onTranscriptRef.current((finalRef.current + interim).trim());
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    finalRef.current = "";
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      // start() throws if called while already running — safe to ignore.
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isSupported, isListening, start, stop };
}

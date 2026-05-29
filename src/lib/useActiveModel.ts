"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_MODEL_ID,
  getModelOption,
  type ModelOption,
} from "./models";

/**
 * The active-model selection, persisted to localStorage and shared live across
 * every mounted component (Models panel, top bar, Claude Console) via a small
 * module-level store. Updating it in one place re-renders all consumers
 * immediately, and a `storage` listener keeps other tabs in sync.
 */
const STORAGE_KEY = "agentic-os:active-model";

let current = DEFAULT_MODEL_ID;
const listeners = new Set<() => void>();
let initialized = false;

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MODEL_ID;
  } catch {
    return DEFAULT_MODEL_ID;
  }
}

/** Hydrate from storage once and start listening for cross-tab changes. */
function ensureInit(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  current = readStored();
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    const next = e.newValue ?? DEFAULT_MODEL_ID;
    if (next !== current) {
      current = next;
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(listener: () => void): () => void {
  ensureInit();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string {
  ensureInit();
  return current;
}

/** Server snapshot — the default keeps SSR/first paint deterministic. */
function getServerSnapshot(): string {
  return DEFAULT_MODEL_ID;
}

function setActive(id: string): void {
  if (id === current) return;
  current = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore quota / unavailable storage */
  }
  listeners.forEach((l) => l());
}

export interface ActiveModel {
  /** The resolved active model option. */
  model: ModelOption;
  /** The active model's stable id. */
  modelId: string;
  /** Switch the active model by id. */
  setModelId: (id: string) => void;
}

/** Subscribe to (and mutate) the active model from any client component. */
export function useActiveModel(): ActiveModel {
  const modelId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setModelId = useCallback((id: string) => setActive(id), []);
  return { model: getModelOption(modelId), modelId, setModelId };
}

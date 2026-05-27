"use client";

import type { VaultEntryInput } from "./vault";

/**
 * Persist an entry to the Obsidian vault via the API. Fire-and-forget: vault
 * failures are logged but never surface to the user or interrupt chat UX.
 */
export async function saveToVault(entry: VaultEntryInput): Promise<void> {
  try {
    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[vault] save failed (${res.status}): ${detail}`);
    }
  } catch (e) {
    console.error("[vault] save error:", e);
  }
}

/** Convenience wrapper for the common case: a completed chat exchange. */
export function saveChatExchange(args: {
  agentName: string;
  userMessage: string;
  assistantMessage: string;
  timestamp?: number;
}): void {
  void saveToVault({ type: "chat", ...args });
}

"use client";

import type { GoalItem, VaultEntryInput } from "./vault";

export type VaultSaveResult =
  | { ok: true; relativePath: string }
  | { ok: false; error: string };

/** POST an entry to the vault API and report success/failure to the caller. */
export async function postVault(entry: VaultEntryInput): Promise<VaultSaveResult> {
  try {
    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    const data: unknown = await res.json().catch(() => null);
    const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;

    if (!res.ok || !obj || obj.ok !== true) {
      const error = obj && typeof obj.error === "string" ? obj.error : `HTTP ${res.status}`;
      return { ok: false, error };
    }
    return {
      ok: true,
      relativePath: typeof obj.relativePath === "string" ? obj.relativePath : "",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Persist the full current goal list as a checkbox task list. */
export function saveGoals(goals: GoalItem[]): Promise<VaultSaveResult> {
  return postVault({ type: "goal", goals });
}

/** Persist the day's journal entry. */
export function saveJournal(body: string): Promise<VaultSaveResult> {
  return postVault({ type: "journal", body });
}

/**
 * Shared markdown save for any panel: writes `content` to
 * `Agentic OS/<section>/<file>.md` in the vault via POST /api/obsidian.
 */
export async function saveVaultMarkdown(args: {
  section: string;
  file: string;
  content: string;
  mode?: "replace" | "append";
}): Promise<VaultSaveResult> {
  try {
    const res = await fetch("/api/obsidian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data: unknown = await res.json().catch(() => null);
    const obj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    if (!res.ok || !obj || obj.ok !== true) {
      const error = obj && typeof obj.error === "string" ? obj.error : `HTTP ${res.status}`;
      return { ok: false, error };
    }
    return { ok: true, relativePath: typeof obj.relativePath === "string" ? obj.relativePath : "" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Fire-and-forget persistence of a completed chat exchange. Vault failures are
 * logged but never surface to the user or interrupt chat UX.
 */
export function saveChatExchange(args: {
  agentName: string;
  userMessage: string;
  assistantMessage: string;
  timestamp?: number;
}): void {
  void postVault({ type: "chat", ...args }).then((r) => {
    if (!r.ok) console.error("[vault] chat save failed:", r.error);
  });
}

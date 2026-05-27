/**
 * Server-side config resolution (uses node:fs). Reads the gitignored
 * `config.json`, merges it over the built-in defaults, and applies env
 * overrides. Imported only by Next route handlers — never by the browser.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { type AppConfig, mergeConfig } from "./config";

export const CONFIG_FILE = "config.json";

let cached: AppConfig | null = null;

/** Where the runtime config lives (overridable for tests). */
export function configPath(): string {
  return process.env.AGENTIC_OS_CONFIG_PATH?.trim() || join(process.cwd(), CONFIG_FILE);
}

/** Fallback vault root when nothing is configured — keeps the app usable out of the box. */
export function defaultVaultPath(): string {
  return join(homedir(), "Documents");
}

/**
 * Resolve the effective config. Precedence for the vault path:
 * env var > config.json > built-in default (~/Documents).
 */
export function loadConfig(force = false): AppConfig {
  if (cached && !force) return cached;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(readFileSync(configPath(), "utf8"));
  } catch {
    parsed = null; // missing/invalid config.json => defaults only
  }

  const merged = mergeConfig(parsed);
  const path =
    process.env.OBSIDIAN_VAULT_PATH?.trim() ||
    (merged.vault.path.trim().length > 0 ? merged.vault.path : defaultVaultPath());
  const folder = process.env.AGENTIC_OS_FOLDER?.trim() || merged.vault.folder;

  cached = { ...merged, vault: { path, folder } };
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}

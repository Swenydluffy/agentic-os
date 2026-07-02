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

/** Where the runtime config lives (overridable for tests). */
export function configPath(): string {
  return process.env.AGENTIC_OS_CONFIG_PATH?.trim() || join(process.cwd(), CONFIG_FILE);
}

/** Fallback vault root when nothing is configured — keeps the app usable out of the box. */
export function defaultVaultPath(): string {
  return join(homedir(), "Documents");
}

/**
 * Resolve the effective config (read fresh each call so runtime edits to
 * config.json — by the user or the setup wizard — are always reflected).
 * Precedence for the vault path: env var > config.json > default (~/Documents).
 */
export function loadConfig(): AppConfig {
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

  const hermes = {
    url: process.env.HERMES_URL?.trim() || merged.hermes.url,
    token: process.env.HERMES_TOKEN?.trim() || merged.hermes.token,
  };

  return { ...merged, vault: { path, folder }, hermes };
}

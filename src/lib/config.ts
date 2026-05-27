/**
 * App configuration types and defaults (client-safe — no fs / no Node APIs).
 *
 * The committed `config.example.json` is the single source of built-in defaults
 * (vault folder, model IDs, agent roster). Per-machine overrides live in a
 * gitignored `config.json`, resolved at runtime by `config.server.ts`.
 */
import exampleConfig from "../../config.example.json";

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  enabled: boolean;
}

export interface VaultSettings {
  /** Absolute path to the Obsidian vault root. Empty => resolved at runtime. */
  path: string;
  /** Subfolder within the vault that the app writes into. */
  folder: string;
}

export interface ModelSettings {
  opus: string;
  sonnet: string;
  haiku: string;
}

export interface AppConfig {
  vault: VaultSettings;
  models: ModelSettings;
  agents: AgentConfig[];
  detectedTools: string[];
}

/** Built-in defaults, sourced from the committed config.example.json. */
export const DEFAULT_CONFIG: AppConfig = exampleConfig as AppConfig;

/** Model IDs — the single source for the app's model selection. */
export const MODELS: ModelSettings = DEFAULT_CONFIG.models;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseAgents(arr: readonly unknown[], fallback: AgentConfig[]): AgentConfig[] {
  const out: AgentConfig[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const a = item as Record<string, unknown>;
    if (typeof a.id !== "string" || typeof a.name !== "string" || typeof a.model !== "string") continue;
    out.push({ id: a.id, name: a.name, model: a.model, enabled: a.enabled !== false });
  }
  return out.length > 0 ? out : clone(fallback);
}

/** Deep-merge an untrusted partial (e.g. parsed config.json) over the defaults. */
export function mergeConfig(partial: unknown): AppConfig {
  const base = DEFAULT_CONFIG;
  if (typeof partial !== "object" || partial === null) return clone(base);
  const p = partial as Record<string, unknown>;

  const vault =
    typeof p.vault === "object" && p.vault !== null ? (p.vault as Record<string, unknown>) : {};
  const models =
    typeof p.models === "object" && p.models !== null ? (p.models as Record<string, unknown>) : {};

  return {
    vault: {
      path: typeof vault.path === "string" ? vault.path : base.vault.path,
      folder:
        typeof vault.folder === "string" && vault.folder.trim().length > 0
          ? vault.folder
          : base.vault.folder,
    },
    models: {
      opus: typeof models.opus === "string" ? models.opus : base.models.opus,
      sonnet: typeof models.sonnet === "string" ? models.sonnet : base.models.sonnet,
      haiku: typeof models.haiku === "string" ? models.haiku : base.models.haiku,
    },
    agents: Array.isArray(p.agents) ? parseAgents(p.agents, base.agents) : clone(base.agents),
    detectedTools: Array.isArray(p.detectedTools)
      ? p.detectedTools.filter((t): t is string => typeof t === "string")
      : [...base.detectedTools],
  };
}

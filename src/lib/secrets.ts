/**
 * Server-side Secrets Vault client (server-only — never import from the browser).
 *
 * Talks to the local 1Password CLI (`op`) using a service-account token read
 * from `process.env.OP_SERVICE_ACCOUNT_TOKEN`, lists the items in the `Tech-Dev`
 * vault, maps each item to a known AI provider, then health-checks that
 * provider's API with the *stored key* to prove the key actually works.
 *
 * SECURITY: secret values are read here and used only to make the outbound
 * health-check request. They are NEVER returned to the caller — the public
 * `SecretStatus` carries booleans, labels, and a coarse reason code only. Keys
 * never leave the server process.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** The 1Password vault to read keys from. */
const VAULT = "Tech-Dev";
/** Allow overriding the op binary location (defaults to PATH lookup). */
const OP_BIN = process.env.OP_CLI_PATH?.trim() || "op";
/** Abort an individual provider probe if it doesn't answer quickly. */
const HEALTH_TIMEOUT_MS = 6000;
/** Guard the `op` CLI calls so a hung agent can't stall the route. */
const OP_TIMEOUT_MS = 15_000;

/** Providers we know how to health-check (the six endpoints in scope). */
export type ServiceId =
  | "anthropic"
  | "openai"
  | "xai"
  | "groq"
  | "deepseek"
  | "openrouter";

/** Why a key is (or isn't) reported active — mirrors the Models panel reasons. */
export type HealthReason =
  | "online" // live request to the provider succeeded
  | "invalid-key" // provider rejected the key (401/403)
  | "missing-key" // 1Password item had an empty/absent secret
  | "unreachable" // network error / timeout reaching the provider
  | "error" // provider answered with some other non-OK status
  | "untested"; // item maps to no known endpoint — nothing was probed

/** One vault item, shaped for the panel. Carries NO secret material. */
export interface SecretStatus {
  /** 1Password item id (stable, opaque). */
  id: string;
  /** The item's title — the "API key name" shown on the card. */
  name: string;
  /** Mapped provider, or null when the item isn't one of the six. */
  service: ServiceId | null;
  /** Human-readable service name ("Anthropic", "OpenRouter", "Other"). */
  serviceLabel: string;
  /** Brand colour (hex) for the card's logo dot. */
  color: string;
  /** True when a live round-trip with the stored key succeeded. */
  active: boolean;
  /** Whether we actually probed an endpoint (false for unmapped items). */
  checked: boolean;
  /** Coarse status so the card can show a truthful label. */
  reason: HealthReason;
}

export type SecretsErrorCode =
  | "unconfigured" // OP_SERVICE_ACCOUNT_TOKEN missing
  | "op-missing" // `op` binary not found on PATH
  | "op-auth" // token rejected by 1Password
  | "op-error"; // any other op/CLI failure

export interface SecretsResult {
  ok: boolean;
  items: SecretStatus[];
  error?: string;
  code?: SecretsErrorCode;
}

/** Provider definition: how to label it, colour it, and probe its API. */
interface ProviderDef {
  label: string;
  color: string;
  /** Match against the lowercased item title. */
  match: (title: string) => boolean;
  /** Issue a health-check request for `key`. Resolves to the fetch Response. */
  probe: (key: string, signal: AbortSignal) => Promise<Response>;
}

/** A plain Bearer-auth GET to a `/models`-style endpoint (OpenAI-compatible). */
function bearerModelsProbe(url: string) {
  return (key: string, signal: AbortSignal) =>
    fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal,
      cache: "no-store",
    });
}

/**
 * The six providers in scope, in match-priority order. OpenRouter is checked
 * before OpenAI/xAI so "OpenRouter API Key" can't be mis-tagged, and the xAI
 * matcher is deliberately narrow ("xai"/"x.ai"/"grok") so unrelated items like
 * "X Twitter Keys" don't get pulled in.
 */
const PROVIDERS: Record<ServiceId, ProviderDef> = {
  openrouter: {
    label: "OpenRouter",
    color: "#a78bfa",
    match: (t) => t.includes("openrouter"),
    probe: bearerModelsProbe("https://openrouter.ai/api/v1/models"),
  },
  anthropic: {
    label: "Anthropic",
    color: "#d97757",
    match: (t) => t.includes("anthropic") || t.includes("claude"),
    // Anthropic has no Bearer /models endpoint; probe the Messages API with a
    // 1-token request using the x-api-key + anthropic-version headers.
    probe: (key, signal) =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal,
        cache: "no-store",
      }),
  },
  openai: {
    label: "OpenAI",
    color: "#10a37f",
    match: (t) => t.includes("openai"),
    probe: bearerModelsProbe("https://api.openai.com/v1/models"),
  },
  xai: {
    label: "xAI",
    color: "#94a3b8",
    match: (t) => t.includes("xai") || t.includes("x.ai") || t.includes("grok"),
    probe: bearerModelsProbe("https://api.x.ai/v1/models"),
  },
  groq: {
    label: "Groq",
    color: "#60a5fa",
    match: (t) => t.includes("groq"),
    probe: bearerModelsProbe("https://api.groq.com/openai/v1/models"),
  },
  deepseek: {
    label: "DeepSeek",
    color: "#4d6bfe",
    match: (t) => t.includes("deepseek"),
    probe: bearerModelsProbe("https://api.deepseek.com/v1/models"),
  },
};

/** Stable order to try matchers in (priority: OpenRouter before OpenAI/xAI). */
const MATCH_ORDER: ServiceId[] = [
  "openrouter",
  "anthropic",
  "openai",
  "deepseek",
  "groq",
  "xai",
];

/** Map a 1Password item title to one of the six providers, or null. */
function detectService(title: string): ServiceId | null {
  const t = title.toLowerCase();
  for (const id of MATCH_ORDER) {
    if (PROVIDERS[id].match(t)) return id;
  }
  return null;
}

/** A single item as returned by `op item list --format json`. */
interface OpItem {
  id?: unknown;
  title?: unknown;
}

/** Run an `op` subcommand with the service-account token in its environment. */
async function runOp(args: string[], token: string): Promise<string> {
  const { stdout } = await execFileAsync(OP_BIN, args, {
    env: { ...process.env, OP_SERVICE_ACCOUNT_TOKEN: token },
    timeout: OP_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

/** Translate a raw `op`/spawn failure into a coarse, caller-friendly code. */
function classifyOpError(e: unknown): { code: SecretsErrorCode; error: string } {
  const err = e as { code?: string; stderr?: string; message?: string };
  if (err?.code === "ENOENT") {
    return {
      code: "op-missing",
      error: "1Password CLI (op) not found. Install it with `brew install 1password-cli`.",
    };
  }
  const stderr = (err?.stderr ?? err?.message ?? String(e)).trim();
  if (/sign|auth|token|unauthor/i.test(stderr)) {
    return { code: "op-auth", error: `1Password rejected the service-account token: ${stderr}` };
  }
  return { code: "op-error", error: stderr || "1Password CLI call failed." };
}

/** Probe a provider with the stored key and reduce the result to a reason. */
async function healthCheck(service: ServiceId, key: string): Promise<HealthReason> {
  if (!key) return "missing-key";
  try {
    const res = await PROVIDERS[service].probe(key, AbortSignal.timeout(HEALTH_TIMEOUT_MS));
    if (res.ok) return "online";
    if (res.status === 401 || res.status === 403) return "invalid-key";
    return "error";
  } catch {
    // Timeout, DNS failure, offline, etc.
    return "unreachable";
  }
}

/**
 * List every item in the Tech-Dev vault, map each to a provider, and health-check
 * the mapped ones in parallel using their stored keys. Returns a result object
 * rather than throwing — `ok:false` with a `code` describes any failure.
 */
export async function readSecretsVault(): Promise<SecretsResult> {
  const token = process.env.OP_SERVICE_ACCOUNT_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      items: [],
      code: "unconfigured",
      error: "OP_SERVICE_ACCOUNT_TOKEN is not set on the server.",
    };
  }

  // 1) List the vault.
  let rawList: string;
  try {
    rawList = await runOp(["item", "list", "--vault", VAULT, "--format", "json"], token);
  } catch (e) {
    return { ok: false, items: [], ...classifyOpError(e) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawList);
  } catch {
    return { ok: false, items: [], code: "op-error", error: "Could not parse `op item list` output." };
  }
  const list: OpItem[] = Array.isArray(parsed) ? (parsed as OpItem[]) : [];

  // 2) For each item, resolve service; fetch + probe the key only for mapped ones.
  const items = await Promise.all(
    list.map(async (raw): Promise<SecretStatus | null> => {
      const id = typeof raw.id === "string" ? raw.id : null;
      const name = typeof raw.title === "string" ? raw.title : null;
      if (!id || !name) return null;

      const service = detectService(name);
      if (!service) {
        return {
          id,
          name,
          service: null,
          serviceLabel: "Other",
          color: "#64748b",
          active: false,
          checked: false,
          reason: "untested",
        };
      }

      const def = PROVIDERS[service];

      // Read the secret, then immediately spend it on the health check. The
      // value is scoped to this block and never returned to the caller.
      let key = "";
      try {
        key = (await runOp(["read", `op://${VAULT}/${id}/password`], token)).trim();
      } catch {
        key = ""; // treated as missing-key below
      }

      const reason = await healthCheck(service, key);
      return {
        id,
        name,
        service,
        serviceLabel: def.label,
        color: def.color,
        active: reason === "online",
        checked: true,
        reason,
      };
    }),
  );

  const clean = items.filter((x): x is SecretStatus => x !== null);

  // Surface checked (mapped) services first, then the rest; alphabetical within.
  clean.sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { ok: true, items: clean };
}

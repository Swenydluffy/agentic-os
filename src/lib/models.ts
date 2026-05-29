/**
 * Model catalog — the single source of truth for the selectable AI models,
 * shared by the client (Models panel, top bar, Claude Console) and the
 * `/api/chat` route. Pure data with no Node APIs, so it is safe to import
 * from both the browser and server route handlers.
 */

/** Supported model providers. */
export type ProviderId = "anthropic" | "openai" | "xai" | "deepseek";

export interface ModelOption {
  /** Stable card id, persisted in localStorage. */
  id: string;
  /** Full display name (cards, console header). */
  name: string;
  /** Compact label for the top bar. */
  shortName: string;
  /** Which API serves this model. */
  provider: ProviderId;
  /** Human-readable provider name. */
  providerLabel: string;
  /** Identifier sent to the provider's API. */
  model: string;
  /** Provider brand colour (hex) for the logo dot. */
  color: string;
  /** One-line description shown on the card. */
  tagline: string;
  /** True for the provider wired in and active out of the box (Anthropic). */
  current: boolean;
}

/**
 * The four models surfaced in the Models panel. Anthropic is the default and
 * is fully wired; the OpenAI-compatible providers (OpenAI, xAI, DeepSeek) come
 * online once their API key is present in the environment — see `/api/chat`.
 */
export const MODEL_OPTIONS: readonly ModelOption[] = [
  {
    id: "claude",
    name: "Claude Sonnet 4.6",
    shortName: "Claude",
    provider: "anthropic",
    providerLabel: "Anthropic",
    model: "claude-sonnet-4-6",
    color: "#d97757",
    tagline: "Operator-in-residence. Deep reasoning, native to this bridge.",
    current: true,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    shortName: "GPT-4o",
    provider: "openai",
    providerLabel: "OpenAI",
    model: "gpt-4o",
    color: "#10a37f",
    tagline: "OpenAI's fast multimodal flagship.",
    current: false,
  },
  {
    id: "grok",
    name: "Grok",
    shortName: "Grok",
    provider: "xai",
    providerLabel: "xAI",
    model: "grok-2-latest",
    color: "#94a3b8",
    tagline: "xAI's witty, real-time model.",
    current: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DeepSeek",
    provider: "deepseek",
    providerLabel: "DeepSeek",
    model: "deepseek-chat",
    color: "#4d6bfe",
    tagline: "Open, efficient reasoning at low cost.",
    current: false,
  },
] as const;

/** The id selected when nothing has been persisted yet. */
export const DEFAULT_MODEL_ID = "claude";

/** Look up a model option by id, falling back to the default (Claude). */
export function getModelOption(id: string | null | undefined): ModelOption {
  return (
    MODEL_OPTIONS.find((m) => m.id === id) ??
    MODEL_OPTIONS.find((m) => m.id === DEFAULT_MODEL_ID) ??
    MODEL_OPTIONS[0]
  );
}

/**
 * OpenAI-compatible endpoint config for the non-Anthropic providers. Each of
 * these exposes the same `/chat/completions` streaming API, so one fetch-based
 * client (in `/api/chat`) drives all three.
 */
export interface OpenAICompatProvider {
  /** Full chat-completions endpoint URL. */
  url: string;
  /** Environment variable holding the API key. */
  envKey: string;
}

export const OPENAI_COMPAT_PROVIDERS: Record<
  Exclude<ProviderId, "anthropic">,
  OpenAICompatProvider
> = {
  openai: { url: "https://api.openai.com/v1/chat/completions", envKey: "OPENAI_API_KEY" },
  xai: { url: "https://api.x.ai/v1/chat/completions", envKey: "XAI_API_KEY" },
  deepseek: { url: "https://api.deepseek.com/v1/chat/completions", envKey: "DEEPSEEK_API_KEY" },
};

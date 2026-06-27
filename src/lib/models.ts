/**
 * Model catalog — single source of truth for the 14 selectable models.
 * All models route through OpenRouter.
 * Validated against openrouter.ai/api/v1/models on 2026-06-26.
 *
 * strengths[] is a DATA FIELD per model — NOT hardcoded in the UI.
 * Phase 4 rating system will update these tags automatically from Brad's ratings.
 */

export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "deepseek"
  | "meta";

export type Tier = "top" | "mid" | "budget";

export interface ModelOption {
  /** Stable card id, persisted in localStorage. */
  id: string;
  /** Full display name (cards, console header). */
  name: string;
  /** Compact label for the top bar. */
  shortName: string;
  /** Which provider family this belongs to. */
  provider: ProviderId;
  /** Human-readable provider name. */
  providerLabel: string;
  /** OpenRouter model identifier (sent as the `model` field). */
  model: string;
  /** Provider brand colour (hex). */
  color: string;
  /** One-line description shown on the card. */
  tagline: string;
  /** Tier: top / mid / budget. */
  tier: Tier;
  /** Cost per 1M input tokens (USD). */
  inputPer1M: number;
  /** Cost per 1M output tokens (USD). */
  outputPer1M: number;
  /**
   * Strength tags — 1-3 words each, glanceable use-case signals.
   * Stored as a data field so Phase 4 auto-rating can update them
   * without touching the UI layer. Max ~3 tags per model.
   */
  strengths: readonly string[];
  /** True for the default model. */
  current: boolean;
}

export const MODEL_OPTIONS: readonly ModelOption[] = [
  // ── TOP TIER ──────────────────────────────────────────────────────────────
  {
    id: "claude-opus-4.8",
    name: "Claude Opus 4.8",
    shortName: "Opus 4.8",
    provider: "anthropic",
    providerLabel: "Anthropic",
    model: "anthropic/claude-opus-4.8",
    color: "#e07950",
    tagline: "Anthropic's most powerful model. Max reasoning, max cost.",
    tier: "top",
    inputPer1M: 15,
    outputPer1M: 75,
    strengths: ["complex reasoning", "hard coding"],
    current: false,
  },
  {
    id: "claude-sonnet-4.6",
    name: "Claude Sonnet 4.6",
    shortName: "Sonnet 4.6",
    provider: "anthropic",
    providerLabel: "Anthropic",
    model: "anthropic/claude-sonnet-4.6",
    color: "#e07950",
    tagline: "Best balance of speed, reasoning, and cost. Default.",
    tier: "top",
    inputPer1M: 3,
    outputPer1M: 15,
    strengths: ["all-around", "coding", "writing"],
    current: true,
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    shortName: "GPT-5.5",
    provider: "openai",
    providerLabel: "OpenAI",
    model: "openai/gpt-5.5",
    color: "#10a37f",
    tagline: "OpenAI's top-tier flagship.",
    tier: "top",
    inputPer1M: 10,
    outputPer1M: 30,
    strengths: ["reasoning", "all-around"],
    current: false,
  },
  {
    id: "gpt-5.5-pro",
    name: "GPT-5.5 Pro",
    shortName: "GPT-5.5 Pro",
    provider: "openai",
    providerLabel: "OpenAI",
    model: "openai/gpt-5.5-pro",
    color: "#10a37f",
    tagline: "OpenAI's extended-context pro variant.",
    tier: "top",
    inputPer1M: 30,
    outputPer1M: 60,
    strengths: ["deep reasoning"],
    current: false,
  },
  {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    shortName: "Gemini 3.1 Pro",
    provider: "google",
    providerLabel: "Google",
    model: "google/gemini-3.1-pro-preview",
    color: "#4285f4",
    tagline: "Google's top multimodal model.",
    tier: "top",
    inputPer1M: 7,
    outputPer1M: 21,
    strengths: ["long docs", "vision", "research"],
    current: false,
  },
  {
    id: "grok-4.3",
    name: "Grok 4.3",
    shortName: "Grok 4.3",
    provider: "xai",
    providerLabel: "xAI",
    model: "x-ai/grok-4.3",
    color: "#1da1f2",
    tagline: "xAI's latest reasoning model with real-time context.",
    tier: "top",
    inputPer1M: 3,
    outputPer1M: 15,
    strengths: ["reasoning", "current info"],
    current: false,
  },
  // ── MID TIER ──────────────────────────────────────────────────────────────
  {
    id: "claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    shortName: "Haiku 4.5",
    provider: "anthropic",
    providerLabel: "Anthropic",
    model: "anthropic/claude-haiku-4.5",
    color: "#e07950",
    tagline: "Fast Anthropic model. Good for high-volume tasks.",
    tier: "mid",
    inputPer1M: 1,
    outputPer1M: 5,
    strengths: ["fast chat", "quick tasks"],
    current: false,
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    shortName: "GPT-5.4",
    provider: "openai",
    providerLabel: "OpenAI",
    model: "openai/gpt-5.4",
    color: "#10a37f",
    tagline: "OpenAI mid-tier, strong reasoning at lower cost.",
    tier: "mid",
    inputPer1M: 5,
    outputPer1M: 15,
    strengths: ["all-around", "value"],
    current: false,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    shortName: "Gemini 3.5 Flash",
    provider: "google",
    providerLabel: "Google",
    model: "google/gemini-3.5-flash",
    color: "#4285f4",
    tagline: "Google's fast mid-tier model. Great throughput.",
    tier: "mid",
    inputPer1M: 0.15,
    outputPer1M: 0.60,
    strengths: ["fast", "long-context"],
    current: false,
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    shortName: "DeepSeek V4 Pro",
    provider: "deepseek",
    providerLabel: "DeepSeek",
    model: "deepseek/deepseek-v4-pro",
    color: "#7c6af7",
    tagline: "DeepSeek's flagship. Strong reasoning, very low cost.",
    tier: "mid",
    inputPer1M: 0.27,
    outputPer1M: 1.10,
    strengths: ["coding", "technical", "value"],
    current: false,
  },
  // ── BUDGET TIER ───────────────────────────────────────────────────────────
  {
    id: "gpt-5.4-mini",
    name: "GPT-5.4 Mini",
    shortName: "GPT-5.4 Mini",
    provider: "openai",
    providerLabel: "OpenAI",
    model: "openai/gpt-5.4-mini",
    color: "#10a37f",
    tagline: "OpenAI budget model. Fast and cheap.",
    tier: "budget",
    inputPer1M: 0.40,
    outputPer1M: 1.60,
    strengths: ["quick simple tasks"],
    current: false,
  },
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    shortName: "DeepSeek V4 Flash",
    provider: "deepseek",
    providerLabel: "DeepSeek",
    model: "deepseek/deepseek-v4-flash",
    color: "#7c6af7",
    tagline: "DeepSeek's fastest model. Ultra-low cost.",
    tier: "budget",
    inputPer1M: 0.07,
    outputPer1M: 0.28,
    strengths: ["cheap coding"],
    current: false,
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    shortName: "Gemini 3.1 Lite",
    provider: "google",
    providerLabel: "Google",
    model: "google/gemini-3.1-flash-lite",
    color: "#4285f4",
    tagline: "Google's lightest model. Minimal cost, high speed.",
    tier: "budget",
    inputPer1M: 0.075,
    outputPer1M: 0.30,
    strengths: ["fast", "cheap"],
    current: false,
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    shortName: "Llama 3.3 70B",
    provider: "meta",
    providerLabel: "Meta",
    model: "meta-llama/llama-3.3-70b-instruct",
    color: "#0867ff",
    tagline: "Meta's open 70B model via OpenRouter.",
    tier: "budget",
    inputPer1M: 0.10,
    outputPer1M: 0.32,
    strengths: ["general open-model"],
    current: false,
  },
] as const;

export const DEFAULT_MODEL_ID = "claude-sonnet-4.6";

export function getModelOption(id: string | null | undefined): ModelOption {
  if (!id) return MODEL_OPTIONS.find((m) => m.id === DEFAULT_MODEL_ID) ?? MODEL_OPTIONS[0];
  // Match on exact id OR on the bare name after stripping a provider prefix (e.g. "anthropic/claude-opus-4.8" -> "claude-opus-4.8")
  const bare = id.includes("/") ? id.split("/").slice(1).join("/") : id;
  return (
    MODEL_OPTIONS.find((m) => m.id === id) ??
    MODEL_OPTIONS.find((m) => m.id === bare) ??
    MODEL_OPTIONS.find((m) => m.id === DEFAULT_MODEL_ID) ??
    MODEL_OPTIONS[0]
  );
}

/**
 * All 14 models route through OpenRouter.
 */
export interface OpenAICompatProvider {
  url: string;
  envKey: string;
}

export const OPENAI_COMPAT_PROVIDERS: Record<ProviderId, OpenAICompatProvider> = {
  anthropic: { url: "https://openrouter.ai/api/v1/chat/completions", envKey: "OPENROUTER_API_KEY" },
  openai:    { url: "https://openrouter.ai/api/v1/chat/completions", envKey: "OPENROUTER_API_KEY" },
  google:    { url: "https://openrouter.ai/api/v1/chat/completions", envKey: "OPENROUTER_API_KEY" },
  xai:       { url: "https://openrouter.ai/api/v1/chat/completions", envKey: "OPENROUTER_API_KEY" },
  deepseek:  { url: "https://openrouter.ai/api/v1/chat/completions", envKey: "OPENROUTER_API_KEY" },
  meta:      { url: "https://openrouter.ai/api/v1/chat/completions", envKey: "OPENROUTER_API_KEY" },
};

/**
 * Pareto Code Router — the pure decision logic that picks the most cost/quality
 * efficient model for a given task. Browser-safe (no Node APIs) so the panel can
 * show the decision instantly, and the chosen model id maps straight onto the
 * existing model catalog in `models.ts` for the `/api/chat` call.
 */
import { getModelOption, type ModelOption } from "./models";

/** The four routing buckets, each tied to a model in the catalog. */
export type RouteCategory = "reasoning" | "speed" | "cost" | "realtime";

export interface RouteRule {
  category: RouteCategory;
  /** Model id in MODEL_OPTIONS this category routes to. */
  modelId: string;
  /** Short label for the strength this bucket optimizes for. */
  strength: string;
  /** Lower-cased keywords that vote for this bucket. */
  signals: string[];
}

/**
 * Ordered so the most specific intents win ties. Real-time and cost are checked
 * before the broad reasoning default. Each maps to a catalog model id.
 */
export const ROUTE_RULES: readonly RouteRule[] = [
  {
    category: "realtime",
    modelId: "grok",
    strength: "Real-time knowledge",
    signals: [
      "today", "current", "latest", "news", "right now", "real-time", "realtime",
      "live", "trending", "weather", "stock", "price", "score", "recent",
      "this week", "breaking", "up to date", "happening",
    ],
  },
  {
    category: "cost",
    modelId: "deepseek",
    strength: "Cost efficiency",
    signals: [
      "cheap", "cheapest", "cost", "budget", "bulk", "batch", "many", "thousands",
      "high volume", "inexpensive", "economical", "low cost", "affordable",
      "boilerplate", "repetitive", "mass",
    ],
  },
  {
    category: "speed",
    modelId: "gpt-4o",
    strength: "Low latency",
    signals: [
      "fast", "quick", "quickly", "asap", "speed", "instant", "snappy", "draft",
      "rapid", "low latency", "real quick", "right away", "hurry", "immediately",
      "autocomplete", "snippet",
    ],
  },
  {
    category: "reasoning",
    modelId: "claude",
    strength: "Deep reasoning",
    signals: [
      "reason", "analyze", "architect", "architecture", "design", "complex",
      "debug", "refactor", "plan", "strategy", "prove", "proof", "explain why",
      "trade-off", "tradeoff", "security", "audit", "algorithm", "deep",
      "thorough", "review", "edge case", "edge-case", "rigorous",
    ],
  },
] as const;

/** The bucket chosen when nothing matches: deep reasoning (Claude). */
export const DEFAULT_CATEGORY: RouteCategory = "reasoning";

export interface RouteDecision {
  category: RouteCategory;
  model: ModelOption;
  strength: string;
  /** The keywords from the task that drove the decision (may be empty). */
  matched: string[];
  /** Human-readable explanation of why this model was chosen. */
  reason: string;
  /** Per-category match counts, for the confidence bars. */
  scores: Record<RouteCategory, number>;
}

const CATEGORY_LABEL: Record<RouteCategory, string> = {
  reasoning: "Deep Reasoning",
  speed: "Speed",
  cost: "Cost Efficiency",
  realtime: "Real-Time Info",
};

/** Count how many of a rule's signals appear in the (lower-cased) task. */
function scoreRule(task: string, rule: RouteRule): { count: number; matched: string[] } {
  const matched = rule.signals.filter((s) => task.includes(s));
  return { count: matched.length, matched };
}

/**
 * Route a task to the best model. Returns the winning category, the resolved
 * model option, the matched keywords, and a reason string. Falls back to the
 * deep-reasoning default (Claude) when no signals fire.
 */
export function routeTask(rawTask: string): RouteDecision {
  const task = rawTask.toLowerCase();

  const scores = {} as Record<RouteCategory, number>;
  let best: RouteRule | null = null;
  let bestMatched: string[] = [];
  let bestCount = 0;

  for (const rule of ROUTE_RULES) {
    const { count, matched } = scoreRule(task, rule);
    scores[rule.category] = count;
    // ROUTE_RULES is priority-ordered, so `>` keeps the higher-priority rule on ties.
    if (count > bestCount) {
      best = rule;
      bestMatched = matched;
      bestCount = count;
    }
  }

  const rule =
    best ?? ROUTE_RULES.find((r) => r.category === DEFAULT_CATEGORY) ?? ROUTE_RULES[0];
  const model = getModelOption(rule.modelId);

  const reason =
    bestCount > 0
      ? `Task signals (${bestMatched.slice(0, 4).join(", ")}) point to ${CATEGORY_LABEL[rule.category]}, where ${model.name} leads. Routed to ${model.providerLabel}.`
      : `No strong signal detected — defaulting to ${CATEGORY_LABEL[rule.category]} with ${model.name} (${model.providerLabel}), the safest choice for open-ended work.`;

  return {
    category: rule.category,
    model,
    strength: rule.strength,
    matched: bestMatched,
    reason,
    scores,
  };
}

export function categoryLabel(category: RouteCategory): string {
  return CATEGORY_LABEL[category];
}

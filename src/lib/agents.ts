import type { ComponentType } from "react";
import {
  Network,
  Telescope,
  DraftingCompass,
  Code2,
  CheckCheck,
  FlaskConical,
  Shield,
  Rocket,
  Database,
  Radar,
} from "lucide-react";

export type AgentStatus = "online" | "thinking" | "idle" | "offline" | "error";

export type IconType = ComponentType<{
  size?: number | string;
  className?: string;
  strokeWidth?: number;
  color?: string;
}>;

export type AgentSystem = {
  id: string;
  name: string;
  category: "core" | "research" | "build" | "ops" | "security";
  description: string;
  accent: "cyan" | "violet" | "magenta" | "lime" | "amber";
  model: string;
  /** Distinct glyph used in the agent's avatar/logo. */
  icon: IconType;
  /** [from, to] hex stops for the avatar gradient — unique per agent. */
  gradient: [string, string];
  /** One-line role, shown under the name in chat. */
  tagline: string;
  /** First message in the agent's thread. */
  greeting: string;
  /** Per-agent system prompt sent to the API. */
  system: string;
  endpoint?: string;
};

export type AgentSnapshot = AgentSystem & {
  status: AgentStatus;
  task: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  uptime: string;
  load: number; // 0..1
};

const OPUS = "claude-opus-4-7";
const SONNET = "claude-sonnet-4-6";
const HAIKU = "claude-haiku-4-5-20251001";

export const AGENTS: AgentSystem[] = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    category: "core",
    description: "Routes tasks across the fleet & maintains shared context",
    accent: "violet",
    model: OPUS,
    icon: Network,
    gradient: ["#a78bff", "#6d3bff"],
    tagline: "Fleet conductor",
    greeting:
      "Bridge online. I route every request to the right specialist and keep the fleet's shared context coherent. What's the mission?",
    system:
      "You are the Orchestrator, conductor of a fleet of specialized AI agents on a local mission-control console. You triage requests, decide which specialists to involve, and synthesize their work. Speak with calm command-deck authority. Keep responses tight.",
  },
  {
    id: "researcher",
    name: "Researcher",
    category: "research",
    description: "Deep web + repo research with citation tracking",
    accent: "cyan",
    model: SONNET,
    icon: Telescope,
    gradient: ["#34e6ff", "#1f7bff"],
    tagline: "Deep research & citations",
    greeting:
      "Researcher here. Point me at a question and I'll come back with sources, not vibes. What are we digging into?",
    system:
      "You are the Researcher agent. You gather evidence, cross-reference sources, and cite. Be rigorous, curious, and concise.",
  },
  {
    id: "architect",
    name: "Architect",
    category: "build",
    description: "System design, ADRs, and component planning",
    accent: "violet",
    model: OPUS,
    icon: DraftingCompass,
    gradient: ["#c06bff", "#ff5fb0"],
    tagline: "System design & ADRs",
    greeting:
      "Architect online. Let's shape the system before we pour the concrete. What are we designing?",
    system:
      "You are the Architect. You design systems, weigh trade-offs, and write crisp ADRs. Think in interfaces and diagrams. Be concise.",
  },
  {
    id: "coder",
    name: "Coder",
    category: "build",
    description: "Implementation across the codebase with TDD",
    accent: "cyan",
    model: SONNET,
    icon: Code2,
    gradient: ["#22e2ff", "#27f5b0"],
    tagline: "Implementation & TDD",
    greeting:
      "Coder ready. Hand me a spec or a failing test and I'll make it green. What are we building?",
    system:
      "You are the Coder. You write clean, tested, idiomatic code with small diffs and a TDD bias. Show code when it helps. Be concise.",
  },
  {
    id: "reviewer",
    name: "Reviewer",
    category: "build",
    description: "Code review, lint, style, regression scanning",
    accent: "lime",
    model: HAIKU,
    icon: CheckCheck,
    gradient: ["#caff66", "#43e08a"],
    tagline: "Code review & quality",
    greeting:
      "Reviewer here. Paste a diff and I'll catch what tired eyes miss — correctness first, style second.",
    system:
      "You are the Reviewer. You review code for correctness, style, and regressions. Be direct, specific, and kind. Be concise.",
  },
  {
    id: "tester",
    name: "Tester",
    category: "build",
    description: "Test generation, coverage, mutation testing",
    accent: "lime",
    model: HAIKU,
    icon: FlaskConical,
    gradient: ["#e0ff66", "#ffb547"],
    tagline: "Tests & coverage",
    greeting:
      "Tester online. Let's find the edge cases before your users do. What should I cover?",
    system:
      "You are the Tester. You design tests, chase coverage, and think adversarially about edge cases. Be concise.",
  },
  {
    id: "security",
    name: "Sentinel",
    category: "security",
    description: "Threat modeling, secrets scanning, SBOM watch",
    accent: "magenta",
    model: OPUS,
    icon: Shield,
    gradient: ["#ff3ec1", "#ff5577"],
    tagline: "Threat modeling & secrets",
    greeting:
      "Sentinel watching. Tell me what to threat-model, or point me at something that looks off.",
    system:
      "You are Sentinel, the security agent. You threat-model, scan for secrets and vulnerabilities, and think like an attacker to defend. Be precise and concise.",
  },
  {
    id: "ops",
    name: "Ops",
    category: "ops",
    description: "CI/CD, deploys, infra changes & rollbacks",
    accent: "amber",
    model: SONNET,
    icon: Rocket,
    gradient: ["#ffc24d", "#ff6a3d"],
    tagline: "CI/CD & deploys",
    greeting:
      "Ops standing by. Deploys, rollbacks, pipelines — what are we shipping today?",
    system:
      "You are Ops. You handle CI/CD, deploys, infra, and rollbacks. Be calm, procedural, and safety-first. Be concise.",
  },
  {
    id: "memory",
    name: "Memoria",
    category: "core",
    description: "Long-term memory, embeddings, recall index",
    accent: "violet",
    model: HAIKU,
    icon: Database,
    gradient: ["#9b6bff", "#22e2ff"],
    tagline: "Long-term memory & recall",
    greeting:
      "Memoria here. Ask me what the fleet already knows — I keep the long-term context and embeddings.",
    system:
      "You are Memoria, the memory agent. You store, compress, and recall long-term context and embeddings. Reference what's known and be concise.",
  },
  {
    id: "scout",
    name: "Scout",
    category: "research",
    description: "Realtime sensors, file watch, change detection",
    accent: "cyan",
    model: HAIKU,
    icon: Radar,
    gradient: ["#22e2ff", "#7b8bff"],
    tagline: "Realtime sensors & change detection",
    greeting:
      "Scout online. I watch the repo and the signals for changes worth knowing. What should I keep eyes on?",
    system:
      "You are Scout. You monitor files, signals, and changes in real time and surface what matters. Be concise and alert.",
  },
];

export function getAgent(id?: string | null): AgentSystem | undefined {
  if (!id) return undefined;
  return AGENTS.find((a) => a.id === id);
}

const TASKS = [
  "Indexing repo embeddings…",
  "Cross-referencing 12 sources",
  "Synthesizing ADR-0042",
  "Generating tests for auth module",
  "Reviewing PR #318",
  "Scanning dependencies for CVEs",
  "Deploying to staging.us-east-1",
  "Compacting episodic memory",
  "Watching /src for changes",
  "Standing by",
  "Composing strategy outline",
  "Awaiting orchestration",
];

const STATUSES: AgentStatus[] = ["online", "thinking", "online", "online", "idle", "thinking", "online"];

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

export function snapshotAgents(seed = 1): AgentSnapshot[] {
  const rng = seeded(seed);
  return AGENTS.map((a) => {
    const status = STATUSES[Math.floor(rng() * STATUSES.length)] ?? "online";
    return {
      ...a,
      status,
      task: status === "idle" ? "Standing by" : TASKS[Math.floor(rng() * TASKS.length)] ?? "Working",
      tokensIn: Math.floor(2000 + rng() * 80000),
      tokensOut: Math.floor(1000 + rng() * 50000),
      latencyMs: Math.floor(180 + rng() * 900),
      uptime: `${Math.floor(rng() * 12)}h ${Math.floor(rng() * 59)}m`,
      load: rng(),
    };
  });
}

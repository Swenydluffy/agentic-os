/**
 * Server-side client for a local Ruflo / OpenClaw swarm gateway (server-only).
 *
 * Ruflo (OpenClaw) exposes a WebSocket JSON-RPC gateway on `:18789`. Reads are
 * gated behind an operator handshake: the client must present the shared gateway
 * token AND a signed Ed25519 device identity. The gateway runs with
 * `controlUi.allowInsecureAuth = true`, so a fresh device that signs the connect
 * challenge with the correct token is accepted (self-pairing) on the loopback host.
 *
 * The shared gateway token lives in `~/.openclaw/openclaw.json` (`gateway.auth.token`).
 * It is read here, server-side only, and NEVER shipped to the browser — the route
 * handler returns derived status, not the token.
 *
 * Frame protocol (over the `/ws` endpoint):
 *   → request:   { type: "req", id, method, params }
 *   ← response:  { type: "res", id, ok, payload }   (ok:false + error on failure)
 *   ← event:     { type: "event", event, payload }  (connect.challenge, …)
 *
 * Handshake:
 *   1. server sends event `connect.challenge` { nonce, ts }
 *   2. client signs the canonical message and sends `connect` with device proof
 *   3. server replies `hello-ok` → the socket can now issue RPCs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign,
  type KeyObject,
} from "node:crypto";
import WebSocket from "ws";

/* --------------------------------- types ---------------------------------- */

export type RufloAgentStatus = "running" | "idle" | "aborted" | "error";

export interface RufloAgent {
  /** Stable identifier (the OpenClaw session key). */
  id: string;
  /** Human-friendly name (agent display name, with a session hint when useful). */
  name: string;
  status: RufloAgentStatus;
  /** What the agent is currently working on, derived from its latest turn. */
  task: string;
  /** Model backing this agent run, when known. */
  model: string;
  /** Tokens consumed by this session so far. */
  totalTokens: number;
  /** Last-activity timestamp (epoch ms). */
  updatedAt: number;
}

export interface RufloStatus {
  online: boolean;
  /** Gateway runtime version, when reachable. */
  version?: string;
  /** Agents currently doing work (running sessions + active tasks). */
  activeAgents: number;
  /** Aspirational fleet size shown alongside the live count. */
  targetAgents: number;
  /** Total known agent sessions (active or idle). */
  totalAgents: number;
  agents: RufloAgent[];
  tasks: { total: number; active: number };
  /** Populated only when the gateway could not be reached. */
  error?: string;
}

export type RufloErrorCode = "unconfigured" | "offline" | "auth" | "protocol" | "timeout";

export class RufloError extends Error {
  readonly code: RufloErrorCode;
  constructor(message: string, code: RufloErrorCode) {
    super(message);
    this.name = "RufloError";
    this.code = code;
  }
}

/** Number of agents the swarm is scaled towards (shown as the "/ N" target). */
export const TARGET_AGENTS = 100;

/* ----------------------------- token resolution ---------------------------- */

interface GatewayCredentials {
  wsUrl: string;
  origin: string;
  token: string;
}

const OPERATOR_SCOPES = [
  "operator.admin",
  "operator.read",
  "operator.write",
  "operator.approvals",
  "operator.pairing",
] as const;

const CLIENT_ID = "openclaw-control-ui";
const CLIENT_MODE = "webchat";
const ROLE = "operator";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function openclawConfigPath(): string {
  return process.env.OPENCLAW_CONFIG_PATH?.trim() || join(homedir(), ".openclaw", "openclaw.json");
}

/** Read the shared gateway token from the OpenClaw config (or RUFLO_TOKEN env). */
function resolveGatewayToken(): string {
  const fromEnv = process.env.RUFLO_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const parsed = asRecord(JSON.parse(readFileSync(openclawConfigPath(), "utf8")));
    const gateway = asRecord(parsed?.gateway);
    const auth = asRecord(gateway?.auth);
    const token = auth?.token;
    if (typeof token === "string" && token.trim().length > 0) return token.trim();
  } catch {
    /* missing/unreadable config => no token */
  }
  return "";
}

/** Resolve ws:// URL + origin from the configured http(s) base URL. */
export function resolveGatewayCredentials(baseUrl: string): GatewayCredentials {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) throw new RufloError("Ruflo URL not configured", "unconfigured");
  const token = resolveGatewayToken();
  if (!token) {
    throw new RufloError(
      "Ruflo gateway token not found (looked in RUFLO_TOKEN and ~/.openclaw/openclaw.json)",
      "unconfigured",
    );
  }
  const wsUrl = `${trimmed.replace(/^http/, "ws")}/ws`;
  return { wsUrl, origin: trimmed, token };
}

/* ------------------------------ device identity ---------------------------- */

const b64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

interface DeviceIdentity {
  deviceId: string;
  publicKey: string;
  privateKey: KeyObject;
}

/**
 * Generate an ephemeral Ed25519 device identity. The deviceId is the SHA-256
 * (hex) of the raw 32-byte public key — matching OpenClaw's derivation.
 */
function createDeviceIdentity(): DeviceIdentity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const rawPub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  const deviceId = createHash("sha256").update(rawPub).digest("hex");
  return { deviceId, publicKey: b64url(rawPub), privateKey };
}

/** Canonical message that the device signs to prove the challenge nonce. */
function canonicalConnectMessage(args: {
  deviceId: string;
  signedAtMs: number;
  token: string;
  nonce: string;
}): string {
  return [
    "v2",
    args.deviceId,
    CLIENT_ID,
    CLIENT_MODE,
    ROLE,
    OPERATOR_SCOPES.join(","),
    String(args.signedAtMs),
    args.token,
    args.nonce,
  ].join("|");
}

/* ------------------------------- ws transport ------------------------------ */

interface ResponseFrame {
  type: "res" | "response";
  id: string;
  ok?: boolean;
  payload?: unknown;
  error?: unknown;
}

interface EventFrame {
  type: "event";
  event: string;
  payload?: unknown;
}

type Rpc = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Open a connection, complete the operator handshake, run `fn` with an `rpc`
 * function, then tear the socket down. Rejects with a RufloError on failure.
 */
async function withGateway<T>(
  creds: GatewayCredentials,
  fn: (rpc: Rpc) => Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const device = createDeviceIdentity();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let idCounter = 0;
    const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();

    const ws = new WebSocket(creds.wsUrl, { headers: { Origin: creds.origin } });

    const timer = setTimeout(() => {
      finish(null, new RufloError("Ruflo gateway timed out", "timeout"));
    }, timeoutMs);

    function finish(value: T | null, err: Error | null): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* already closing */
      }
      if (err) reject(err);
      else resolve(value as T);
    }

    const rpc: Rpc = (method, params) => {
      if (ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new RufloError("Ruflo gateway not connected", "offline"));
      }
      const id = `r${++idCounter}`;
      ws.send(JSON.stringify({ type: "req", id, method, params: params ?? {} }));
      return new Promise<unknown>((res, rej) => {
        pending.set(id, { resolve: res, reject: rej });
      });
    };

    ws.on("message", (data: WebSocket.RawData) => {
      let frame: ResponseFrame | EventFrame;
      try {
        frame = JSON.parse(data.toString()) as ResponseFrame | EventFrame;
      } catch {
        return;
      }

      if (frame.type === "event") {
        if (frame.event === "connect.challenge") {
          void handleChallenge(frame.payload);
        }
        return;
      }

      // Response frame.
      const entry = pending.get(frame.id);
      if (!entry) return;
      pending.delete(frame.id);
      if (frame.ok === false || frame.error) {
        entry.reject(frame.error ?? frame.payload ?? frame);
      } else {
        entry.resolve(frame.payload ?? frame);
      }
    });

    async function handleChallenge(payload: unknown): Promise<void> {
      const p = asRecord(payload);
      const nonce = typeof p?.nonce === "string" ? p.nonce : "";
      const signedAtMs = typeof p?.ts === "number" ? p.ts : Date.now();
      if (!nonce) {
        finish(null, new RufloError("Ruflo challenge missing nonce", "protocol"));
        return;
      }
      const message = canonicalConnectMessage({ deviceId: device.deviceId, signedAtMs, token: creds.token, nonce });
      const signature = b64url(cryptoSign(null, Buffer.from(message, "utf8"), device.privateKey));
      try {
        await rpc("connect", {
          minProtocol: 4,
          maxProtocol: 4,
          client: { id: CLIENT_ID, version: "control-ui", platform: "node", mode: CLIENT_MODE },
          role: ROLE,
          scopes: [...OPERATOR_SCOPES],
          caps: ["tool-events"],
          auth: { token: creds.token },
          device: {
            id: device.deviceId,
            publicKey: device.publicKey,
            signature,
            signedAt: signedAtMs,
            nonce,
          },
        });
        const result = await fn(rpc);
        finish(result, null);
      } catch (e) {
        finish(null, toRufloError(e));
      }
    }

    ws.on("error", (e: Error) => {
      finish(null, new RufloError(`Ruflo gateway unreachable: ${e.message}`, "offline"));
    });

    ws.on("close", () => {
      if (!settled) finish(null, new RufloError("Ruflo gateway closed the connection", "offline"));
    });
  });
}

function toRufloError(e: unknown): RufloError {
  if (e instanceof RufloError) return e;
  const rec = asRecord(e);
  const code = typeof rec?.code === "string" ? rec.code : "";
  const message = typeof rec?.message === "string" ? rec.message : e instanceof Error ? e.message : String(e);
  if (code.includes("PAIR") || code.includes("AUTH") || code.includes("DEVICE") || code.includes("ORIGIN")) {
    return new RufloError(message || "Ruflo authentication failed", "auth");
  }
  return new RufloError(message || "Ruflo request failed", "protocol");
}

/* ------------------------------- data shaping ------------------------------ */

interface SessionRow {
  key: string;
  kind?: string;
  agentId?: string;
  sessionId?: string;
  updatedAt?: number;
  status?: string;
  model?: string;
  totalTokens?: number;
  hasActiveRun?: boolean;
  abortedLastRun?: boolean;
}

interface PreviewRow {
  key: string;
  items?: { role?: string; text?: string }[];
}

const isSystemNoise = (text: string): boolean => {
  const t = text.trim();
  return t.length === 0 || t.startsWith("[OpenClaw") || (t.startsWith("[") && t.endsWith("]"));
};

function deriveStatus(s: SessionRow): RufloAgentStatus {
  if (s.hasActiveRun || s.status === "running") return "running";
  if (s.status === "error" || s.status === "failed") return "error";
  if (s.abortedLastRun) return "aborted";
  return "idle";
}

function deriveTask(preview: PreviewRow | undefined, status: RufloAgentStatus): string {
  const items = preview?.items ?? [];
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.role === "user" && typeof item.text === "string" && !isSystemNoise(item.text)) {
      const text = item.text.trim().replace(/\s+/g, " ");
      return text.length > 140 ? `${text.slice(0, 139)}…` : text;
    }
  }
  return status === "running" ? "Working…" : "Idle — awaiting tasks";
}

function shortModel(model: string): string {
  return model.replace(/^anthropic\//, "");
}

/** Session keys are `agent:<agentId>:<label>`; recover the agentId from the key. */
function agentIdFromKey(key: string): string | undefined {
  const parts = key.split(":");
  if (parts[0] === "agent" && parts[1]) return parts[1];
  return undefined;
}

function parseSessions(payload: unknown): SessionRow[] {
  const rec = asRecord(payload);
  const list = Array.isArray(rec?.sessions) ? rec.sessions : [];
  const rows: SessionRow[] = [];
  for (const item of list) {
    const s = asRecord(item);
    if (!s || typeof s.key !== "string") continue;
    rows.push({
      key: s.key,
      kind: typeof s.kind === "string" ? s.kind : undefined,
      agentId: typeof s.agentId === "string" ? s.agentId : agentIdFromKey(s.key),
      sessionId: typeof s.sessionId === "string" ? s.sessionId : undefined,
      updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : undefined,
      status: typeof s.status === "string" ? s.status : undefined,
      model: typeof s.model === "string" ? s.model : undefined,
      totalTokens: typeof s.totalTokens === "number" ? s.totalTokens : undefined,
      hasActiveRun: typeof s.hasActiveRun === "boolean" ? s.hasActiveRun : undefined,
      abortedLastRun: typeof s.abortedLastRun === "boolean" ? s.abortedLastRun : undefined,
    });
  }
  return rows;
}

async function fetchAgentNames(rpc: Rpc, agentIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  await Promise.all(
    agentIds.map(async (agentId) => {
      try {
        const identity = asRecord(await rpc("agent.identity.get", { agentId }));
        const name = identity?.name;
        if (typeof name === "string" && name.trim().length > 0) names.set(agentId, name.trim());
      } catch {
        /* identity unavailable — fall back to the id */
      }
    }),
  );
  return names;
}

/** Pretty session-instance label, e.g. "Assistant" or "Assistant · cron". */
function agentDisplayName(s: SessionRow, names: Map<string, string>): string {
  const base = (s.agentId && names.get(s.agentId)) || s.agentId || "agent";
  if (s.kind && s.kind !== "direct") return `${base} · ${s.kind}`;
  return base;
}

/* --------------------------------- public ---------------------------------- */

const MAX_AGENTS = 200;

/** Fetch live swarm status + the agent (session) list. Never throws — returns offline on error. */
export async function getRufloStatus(baseUrl: string): Promise<RufloStatus> {
  const offline = (error: string): RufloStatus => ({
    online: false,
    activeAgents: 0,
    targetAgents: TARGET_AGENTS,
    totalAgents: 0,
    agents: [],
    tasks: { total: 0, active: 0 },
    error,
  });

  let creds: GatewayCredentials;
  try {
    creds = resolveGatewayCredentials(baseUrl);
  } catch (e) {
    return offline(e instanceof Error ? e.message : String(e));
  }

  try {
    return await withGateway(creds, async (rpc) => {
      const [statusRes, sessionsRes] = await Promise.all([
        rpc("status").catch(() => ({})),
        rpc("sessions.list").catch(() => ({})),
      ]);

      const statusRec = asRecord(statusRes) ?? {};
      const version = typeof statusRec.runtimeVersion === "string" ? statusRec.runtimeVersion : undefined;
      const tasksRec = asRecord(statusRec.tasks) ?? {};
      const tasks = {
        total: typeof tasksRec.total === "number" ? tasksRec.total : 0,
        active: typeof tasksRec.active === "number" ? tasksRec.active : 0,
      };

      const sessions = parseSessions(sessionsRes).slice(0, MAX_AGENTS);

      // Resolve display names + last-turn previews in parallel.
      const agentIds = Array.from(new Set(sessions.map((s) => s.agentId).filter((v): v is string => !!v)));
      const keys = sessions.map((s) => s.key);
      const [names, previewRes] = await Promise.all([
        fetchAgentNames(rpc, agentIds),
        keys.length > 0 ? rpc("sessions.preview", { keys }).catch(() => ({})) : Promise.resolve({}),
      ]);

      const previews = new Map<string, PreviewRow>();
      const previewList = asRecord(previewRes)?.previews;
      if (Array.isArray(previewList)) {
        for (const item of previewList) {
          const p = asRecord(item);
          if (p && typeof p.key === "string") {
            const items = Array.isArray(p.items)
              ? (p.items as { role?: string; text?: string }[])
              : undefined;
            previews.set(p.key, { key: p.key, items });
          }
        }
      }

      const agents: RufloAgent[] = sessions.map((s) => {
        const status = deriveStatus(s);
        return {
          id: s.key,
          name: agentDisplayName(s, names),
          status,
          task: deriveTask(previews.get(s.key), status),
          model: shortModel(s.model ?? ""),
          totalTokens: s.totalTokens ?? 0,
          updatedAt: s.updatedAt ?? 0,
        };
      });
      agents.sort((a, b) => b.updatedAt - a.updatedAt);

      const runningAgents = agents.filter((a) => a.status === "running").length;

      return {
        online: true,
        version,
        activeAgents: runningAgents + tasks.active,
        targetAgents: TARGET_AGENTS,
        totalAgents: agents.length,
        agents,
        tasks,
      } satisfies RufloStatus;
    });
  } catch (e) {
    const err = toRufloError(e);
    return offline(err.message);
  }
}

export interface LaunchResult {
  sessionKey: string;
}

/** Launch a new agent task: create a fresh session and dispatch the prompt to it. */
export async function launchTask(baseUrl: string, prompt: string): Promise<LaunchResult> {
  const message = prompt.trim();
  if (!message) throw new RufloError("Task prompt is empty", "protocol");
  const creds = resolveGatewayCredentials(baseUrl);

  return withGateway(creds, async (rpc) => {
    const created = asRecord(await rpc("sessions.create", {}));
    const sessionKey = typeof created?.key === "string" ? created.key : "";
    if (!sessionKey) throw new RufloError("sessions.create returned no key", "protocol");
    await rpc("chat.send", {
      sessionKey,
      message,
      deliver: false,
      idempotencyKey: `mc-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    });
    return { sessionKey };
  });
}

export interface StopAllResult {
  stopped: number;
}

/** Stop all agents: abort every session with an active run and cancel active tasks. */
export async function stopAllAgents(baseUrl: string): Promise<StopAllResult> {
  const creds = resolveGatewayCredentials(baseUrl);

  return withGateway(creds, async (rpc) => {
    let stopped = 0;

    const sessions = parseSessions(await rpc("sessions.list").catch(() => ({})));
    const active = sessions.filter((s) => deriveStatus(s) === "running");
    await Promise.all(
      active.map(async (s) => {
        try {
          await rpc("chat.abort", { sessionKey: s.key });
          stopped++;
        } catch {
          /* best-effort: keep aborting the rest */
        }
      }),
    );

    // Cancel any tracked tasks that are still active.
    try {
      const tasksRec = asRecord(await rpc("tasks.list"));
      const list = Array.isArray(tasksRec?.tasks) ? tasksRec.tasks : [];
      await Promise.all(
        list.map(async (item) => {
          const t = asRecord(item);
          const id = typeof t?.id === "string" ? t.id : typeof t?.taskId === "string" ? t.taskId : "";
          const taskStatus = typeof t?.status === "string" ? t.status : "";
          if (!id || taskStatus === "succeeded" || taskStatus === "cancelled" || taskStatus === "failed") return;
          try {
            await rpc("tasks.cancel", { taskId: id });
            stopped++;
          } catch {
            /* best-effort */
          }
        }),
      );
    } catch {
      /* tasks API unavailable — sessions were still aborted */
    }

    return { stopped };
  });
}

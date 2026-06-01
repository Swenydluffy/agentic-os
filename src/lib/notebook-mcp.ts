/**
 * Server-only singleton client for the `notebooklm-mcp` MCP server.
 *
 * The server is spawned ONCE per Node process as a long-lived stdio subprocess
 * (never one-per-request) and speaks newline-delimited JSON-RPC 2.0. The first
 * call performs the `initialize` handshake; every later call reuses the same
 * process. If the subprocess dies, the next call transparently respawns it.
 *
 * The instance is cached on `globalThis` so Next.js dev HMR (which re-evaluates
 * route modules) reuses the same subprocess instead of leaking a new one on
 * every hot reload.
 *
 * Only `/api/notebook` imports this — the browser never touches it.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Absolute path the operator installed the server at (see `which notebooklm-mcp`). */
const DEFAULT_BIN = "/Library/Frameworks/Python.framework/Versions/3.11/bin/notebooklm-mcp";

/** Resolve the server binary: env override → known install path → bare PATH lookup. */
function resolveBin(): string {
  const env = process.env.NOTEBOOKLM_MCP_BIN?.trim();
  if (env && existsSync(env)) return env;
  if (existsSync(DEFAULT_BIN)) return DEFAULT_BIN;
  return "notebooklm-mcp";
}

/** Augment PATH so a bare lookup (and the server's own child tools) resolve. */
function augmentedPath(): string {
  const extra = [
    "/Library/Frameworks/Python.framework/Versions/3.11/bin",
    "/usr/local/bin",
    "/opt/homebrew/bin",
    join(homedir(), ".local", "bin"),
  ];
  return [process.env.PATH ?? "", ...extra].filter(Boolean).join(":");
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Shape of a `tools/call` result (MCP content envelope). */
interface ToolCallResult {
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

/**
 * A live connection to one `notebooklm-mcp` subprocess. Construct lazily via
 * `getNotebookMcp()` — do not `new` this directly.
 */
class NotebookMcpClient {
  private proc: ChildProcessWithoutNullStreams;
  private buf = "";
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly ready: Promise<void>;
  private dead = false;
  private deathReason = "";

  constructor() {
    const bin = resolveBin();
    this.proc = spawn(bin, ["--transport", "stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PATH: augmentedPath() },
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this.onData(chunk));
    // The server logs to stderr (INFO banners etc.) — swallow it; not protocol.
    this.proc.stderr.on("data", () => {});

    this.proc.on("exit", (code, signal) =>
      this.onExit(`notebooklm-mcp exited (code ${code ?? "null"}, signal ${signal ?? "null"})`),
    );
    this.proc.on("error", (err) => this.onExit(`notebooklm-mcp failed to start: ${err.message}`));

    this.ready = this.handshake();
  }

  /** True once the subprocess has died and can no longer serve requests. */
  get isDead(): boolean {
    return this.dead;
  }

  /** Parse complete newline-delimited JSON-RPC messages out of the stdout buffer. */
  private onData(chunk: string): void {
    this.buf += chunk;
    let nl: number;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      let msg: JsonRpcResponse;
      try {
        msg = JSON.parse(line) as JsonRpcResponse;
      } catch {
        continue; // non-JSON noise on stdout — ignore
      }
      if (typeof msg.id !== "number") continue; // notification, not a reply
      const p = this.pending.get(msg.id);
      if (!p) continue;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message || `RPC error ${msg.error.code}`));
      else p.resolve(msg.result);
    }
  }

  /** Mark the connection dead and fail every in-flight request. */
  private onExit(reason: string): void {
    if (this.dead) return;
    this.dead = true;
    this.deathReason = reason;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
    this.pending.clear();
  }

  /** Send a request and await its reply, with a per-call timeout. */
  private request(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    if (this.dead) return Promise.reject(new Error(this.deathReason || "notebooklm-mcp is not running."));
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`notebooklm-mcp timed out after ${Math.round(timeoutMs / 1000)}s (${method}).`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.proc.stdin.write(payload);
      } catch (e) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  /** Fire-and-forget notification (no id, no reply expected). */
  private notify(method: string, params: unknown): void {
    if (this.dead) return;
    try {
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
    } catch {
      /* ignore — a failed write will surface on the next request */
    }
  }

  /** Perform the MCP initialize handshake once at construction. */
  private async handshake(): Promise<void> {
    await this.request(
      "initialize",
      {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "agentic-os-notebook", version: "1.0.0" },
      },
      30_000,
    );
    this.notify("notifications/initialized", {});
  }

  /**
   * Call an MCP tool and return its decoded payload (the tool's JSON result).
   * Prefers `structuredContent`; falls back to parsing the text content block.
   * Throws on transport errors, tool errors (`isError`), or error payloads.
   */
  async callTool(name: string, args: Record<string, unknown>, timeoutMs: number): Promise<Record<string, unknown>> {
    await this.ready;
    const raw = (await this.request("tools/call", { name, arguments: args }, timeoutMs)) as ToolCallResult;

    const text = raw.content?.find((c) => c.type === "text")?.text;
    let payload: unknown = raw.structuredContent;
    if (payload === undefined && typeof text === "string") {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { status: "error", message: text };
      }
    }

    if (raw.isError) {
      throw new Error(extractMessage(payload) || text || `Tool ${name} reported an error.`);
    }
    const obj = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    if (obj.status === "error") {
      throw new Error(extractMessage(obj) || `Tool ${name} reported an error.`);
    }
    return obj;
  }
}

/** Pull a human message out of an error-shaped tool payload. */
function extractMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const o = payload as Record<string, unknown>;
  for (const key of ["message", "error", "hint"]) {
    if (typeof o[key] === "string" && (o[key] as string).trim()) return o[key] as string;
  }
  return "";
}

// Cache the singleton on globalThis so dev HMR doesn't spawn duplicate servers.
const GLOBAL_KEY = Symbol.for("agentic-os.notebook-mcp");
type GlobalWithMcp = typeof globalThis & { [GLOBAL_KEY]?: NotebookMcpClient };

/** Get the shared MCP client, spawning (or respawning) the subprocess as needed. */
export function getNotebookMcp(): NotebookMcpClient {
  const g = globalThis as GlobalWithMcp;
  let client = g[GLOBAL_KEY];
  if (!client || client.isDead) {
    client = new NotebookMcpClient();
    g[GLOBAL_KEY] = client;
  }
  return client;
}

/** Convenience: resolve the singleton and call a tool in one step. */
export function callNotebookTool(
  name: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  return getNotebookMcp().callTool(name, args, timeoutMs);
}

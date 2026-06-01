import { loadConfig } from "@/lib/config.server";
import { pingHermes } from "@/lib/hermes";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

interface ProbeResult {
  name: string;
  ok: boolean;
  detail?: string;
  latencyMs?: number;
}

type ProbeFn = () => Promise<ProbeResult>;

async function probeHermes(): Promise<ProbeResult> {
  const t0 = Date.now();
  const { hermes } = loadConfig();
  if (!hermes.url.trim()) return { name: "Hermes", ok: false, detail: "Not configured" };
  const status = await pingHermes(hermes);
  return {
    name: "Hermes",
    ok: status.online,
    detail: status.online
      ? `v${status.version ?? "?"}${status.gateway ? ` · gateway ${status.gateway}` : ""}`
      : status.error ?? "Offline",
    latencyMs: Date.now() - t0,
  };
}

async function probeTunnel(): Promise<ProbeResult> {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-f", "cloudflared"], { timeout: 3000 });
    const pids = stdout.trim().split("\n").filter(Boolean);
    return { name: "Cloudflare Tunnel", ok: pids.length > 0, detail: `${pids.length} process(es)` };
  } catch {
    return { name: "Cloudflare Tunnel", ok: false, detail: "cloudflared not running" };
  }
}

async function probeObsidian(): Promise<ProbeResult> {
  const { vault } = loadConfig();
  const vaultPath = vault.path || join(homedir(), "Documents");
  const exists = existsSync(vaultPath);
  return { name: "Obsidian Vault", ok: exists, detail: exists ? vaultPath : "Vault path not found" };
}

async function probeOmi(): Promise<ProbeResult> {
  const omiPath = join(homedir(), "Documents", "Omi", "Omi", "Memories.md");
  const exists = existsSync(omiPath);
  return { name: "OMI Memories", ok: exists, detail: exists ? "File accessible" : "Memories.md not found" };
}

async function probeNotebookLM(): Promise<ProbeResult> {
  const t0 = Date.now();
  const candidates = [
    process.env.NLM_BIN,
    join(homedir(), ".local", "bin", "nlm"),
    "/Library/Frameworks/Python.framework/Versions/3.11/bin/nlm",
    "/usr/local/bin/nlm",
    "/opt/homebrew/bin/nlm",
  ].filter((p): p is string => Boolean(p));
  let bin = "nlm";
  for (const c of candidates) { if (existsSync(c)) { bin = c; break; } }
  try {
    const { stdout } = await execFileAsync(bin, ["list", "notebooks", "--json"], {
      timeout: 15000,
      env: { ...process.env, PATH: [process.env.PATH ?? "", "/usr/local/bin", "/opt/homebrew/bin", join(homedir(), ".local", "bin")].join(":") },
    });
    try {
      const data = JSON.parse(stdout.trim());
      const count = Array.isArray(data) ? data.length : 0;
      return { name: "NotebookLM", ok: true, detail: `${count} notebook(s)`, latencyMs: Date.now() - t0 };
    } catch {
      return { name: "NotebookLM", ok: false, detail: "Auth expired or CLI error", latencyMs: Date.now() - t0 };
    }
  } catch {
    return { name: "NotebookLM", ok: false, detail: "nlm CLI not found or failed" };
  }
}

async function probeSelf(): Promise<ProbeResult> {
  return { name: "Mission Control", ok: true, detail: "Serving requests" };
}

const PROBES: ProbeFn[] = [probeSelf, probeHermes, probeTunnel, probeObsidian, probeOmi, probeNotebookLM];

export async function GET() {
  const t0 = Date.now();
  const results = await Promise.all(
    PROBES.map((fn) => fn().catch((e): ProbeResult => ({ name: "Unknown", ok: false, detail: e instanceof Error ? e.message : String(e) })))
);
  const healthy = results.filter((r) => r.ok).length;
  const total = results.length;
  const allOk = healthy === total;
  return Response.json({
    ok: allOk,
    status: allOk ? "All systems nominal" : `${healthy}/${total} systems online`,
    healthy, total, probes: results,
    checkedAt: new Date().toISOString(),
    totalMs: Date.now() - t0,
  });
}

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import * as os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface CronLog {
  name: string;
  lastRun: string | null;
  status: "ok" | "error" | "unknown";
  output: string;
}
export interface SessionLog {
  id: string;
  agent: string;
  started: string;
  durationMs: number;
  status: "completed" | "running" | "failed";
  summary: string;
}
export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  uptimeSeconds: number;
  totalMem: number;
  freeMem: number;
  usedMem: number;
  cpuCount: number;
  cpuModel: string;
  loadAvg: number[];
}

const CRON_DIR = join(homedir(), "cron", "output");
const MAX_OUTPUT = 4000;

/** Read each file in ~/cron/output/ as a cron job log; fall back to samples. */
async function readCronLogs(): Promise<CronLog[]> {
  let entries: string[];
  try {
    entries = (await readdir(CRON_DIR)).filter((f) => !f.startsWith("."));
  } catch {
    return SAMPLE_CRON;
  }
  if (entries.length === 0) return SAMPLE_CRON;

  const logs: CronLog[] = [];
  for (const name of entries.slice(0, 50)) {
    const abs = join(CRON_DIR, name);
    try {
      const s = await stat(abs);
      if (!s.isFile()) continue;
      const text = await readFile(abs, "utf8");
      const output = text.length > MAX_OUTPUT ? text.slice(-MAX_OUTPUT) : text;
      const status: CronLog["status"] = /error|fail|traceback|exception/i.test(output)
        ? "error"
        : "ok";
      logs.push({ name, lastRun: s.mtime.toISOString(), status, output: output.trim() });
    } catch {
      // unreadable — skip
    }
  }
  logs.sort((a, b) => (b.lastRun ?? "").localeCompare(a.lastRun ?? ""));
  return logs.length > 0 ? logs : SAMPLE_CRON;
}

const SAMPLE_CRON: CronLog[] = [
  {
    name: "instagram-post.log",
    lastRun: null,
    status: "unknown",
    output:
      "No cron output found at ~/cron/output/.\nThis is sample data — wire up your cron jobs to write logs here and they'll appear automatically.",
  },
  {
    name: "obsidian-sync.log",
    lastRun: null,
    status: "unknown",
    output: "[sample] git push vault → up to date.",
  },
];

const SAMPLE_SESSIONS: SessionLog[] = [
  {
    id: "sess-1",
    agent: "Orchestrator",
    started: "2026-05-31T22:14:03Z",
    durationMs: 184200,
    status: "completed",
    summary: "Routed 4 tasks · 3 reviewers reached consensus on PR #318.",
  },
  {
    id: "sess-2",
    agent: "Coder",
    started: "2026-05-31T21:51:40Z",
    durationMs: 372500,
    status: "completed",
    summary: "Built Notebook panel + asset Range endpoint · build passed.",
  },
  {
    id: "sess-3",
    agent: "Sentinel",
    started: "2026-05-31T20:09:12Z",
    durationMs: 41800,
    status: "failed",
    summary: "Anomalous token usage flagged on /agent/scout.",
  },
];

function systemInfo(): SystemInfo {
  const cpus = os.cpus();
  const total = os.totalmem();
  const free = os.freemem();
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    nodeVersion: process.version,
    uptimeSeconds: Math.round(os.uptime()),
    totalMem: total,
    freeMem: free,
    usedMem: total - free,
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model?.trim() ?? "unknown",
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
  };
}

/** GET /api/logs → { cron, sessions, system }. */
export async function GET() {
  const cron = await readCronLogs();
  return Response.json({
    ok: true,
    data: { cron, sessions: SAMPLE_SESSIONS, system: systemInfo() },
  });
}

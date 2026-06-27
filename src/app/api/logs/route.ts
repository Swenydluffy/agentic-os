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

const NOTES_URL   = process.env.NOTES_SERVER_URL ?? "https://notes.wynneops.com";

/** Fetch cron job logs from the notes server API. Falls back to samples on error. */
async function readCronLogs(): Promise<CronLog[]> {
  try {
    const res = await fetch(`${NOTES_URL}/api/cron-logs?limit=50`, {
      headers: { "x-notes-token": process.env.NOTES_TOKEN ?? "notes-wynneops-2026" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return SAMPLE_CRON;

    const data = await res.json() as {
      ok: boolean;
      jobs?: Array<{
        job_id: string;
        name: string;
        lastRun: string;
        status: "ok" | "error" | "unknown";
        outputFile: string;
      }>;
    };
    if (!data.ok || !Array.isArray(data.jobs) || data.jobs.length === 0) {
      return SAMPLE_CRON;
    }

    return data.jobs.map((j) => ({
      name:    j.name || j.job_id,
      lastRun: j.lastRun ?? null,
      status:  j.status ?? "unknown",
      output:  "",  // populated on demand via ?file= — not fetched in list view
    }));
  } catch {
    return SAMPLE_CRON;
  }
}

const SAMPLE_CRON: CronLog[] = [
  {
    name: "cron-logs (offline)",
    lastRun: null,
    status: "unknown",
    output: "Notes server unreachable — cron logs unavailable. Check that notes.wynneops.com is running.",
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

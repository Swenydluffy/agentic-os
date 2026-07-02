import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tok = process.env.NOTES_TOKEN ?? "notes-wynneops-2026";
  const base = "https://notes.wynneops.com";
  const hdrs = { "x-notes-token": tok };

  try {
    // Parallel fetch: cron logs + real sysinfo
    const [cronRes, sysRes] = await Promise.all([
      fetch(base + "/api/cron-logs?limit=50", { cache: "no-store", headers: hdrs }),
      fetch(base + "/api/sysinfo",             { cache: "no-store", headers: hdrs }),
    ]);

    // --- cron jobs ---
    let cron: object[] = [];
    if (cronRes.ok) {
      const cronData = await cronRes.json() as {
        jobs?: { name: string; lastRun: string | null; status: string; outputFile?: string }[];
      };
      cron = (cronData.jobs ?? []).map((j) => ({
        name:    j.name,
        lastRun: j.lastRun ?? null,
        status:  j.status === "ok" ? "ok" : j.status === "error" ? "error" : j.status === "paused" ? "paused" : "unknown",
        output:  j.outputFile ?? "",
      }));
    }

    // --- system info (real VPS stats from /proc) ---
    let system = {
      hostname:      "wynneops-vps",
      platform:      "linux",
      arch:          "x64",
      nodeVersion:   "unknown",
      uptimeSeconds: 0,
      totalMem:      0,
      freeMem:       0,
      usedMem:       0,
      diskFree:      0,
      diskTotal:     0,
      cpuCount:      1,
      cpuModel:      "VPS",
      loadAvg:       [0, 0, 0] as number[],
    };
    if (sysRes.ok) {
      const s = await sysRes.json() as typeof system & { ok: boolean };
      if (s.ok) system = s;
    }

    return NextResponse.json(
      { ok: true, data: { cron, sessions: [], system } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}

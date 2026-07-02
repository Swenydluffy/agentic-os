import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NOTES_URL = 'http://31.220.63.57:9120';
const NOTES_TOKEN = process.env.NOTES_TOKEN ?? 'notes-wynneops-2026';
const VAULT_CHATS = '/Users/lucyanne/Documents/Omi/Agentic OS/Chats';
const VAULT_INTAKE = '/Users/lucyanne/Documents/Omi/Agentic OS/Intake';

type HealthStatus = 'green' | 'yellow' | 'red' | 'unknown';
interface HealthItem {
  id: string; label: string; status: HealthStatus; detail: string; updatedAt: string | null;
}

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
function yesterdayET(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

async function fetchNotes(endpoint: string, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(NOTES_URL + endpoint, {
      headers: { 'x-notes-token': NOTES_TOKEN },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function checkVault(): Promise<HealthItem> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(NOTES_URL + '/health', { signal: ctrl.signal, cache: 'no-store' }); clearTimeout(t);
    const data = await res.json();
    if (data?.ok === true) {
      const cnt = data.notes_count ? ' (' + data.notes_count + ' notes)' : '';
      return { id: 'vault', label: 'Vault', status: 'green', detail: 'Notes server OK' + cnt, updatedAt: new Date().toISOString() };
    }
    return { id: 'vault', label: 'Vault', status: 'red', detail: 'Server returned ok:false', updatedAt: null };
  } catch (e: unknown) {
    return { id: 'vault', label: 'Vault', status: 'red', detail: 'Unreachable: ' + (e instanceof Error ? e.message : String(e)), updatedAt: null };
  }
}

// Fetches /api/tg-watermark which returns watermark + brad_context + onnx_index mtimes
async function fetchVpsMetrics() {
  const res = await fetchNotes('/api/tg-watermark');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json() as Promise<{
    ok: boolean;
    watermark: { value: number | null; mtime_iso: string | null; age_seconds: number | null };
    brad_context: { mtime_iso: string | null; age_seconds: number | null };
    onnx_index: { mtime_iso: string | null; age_seconds: number | null };
    phone_intake: { name: string | null; mtime_iso: string | null; age_seconds: number | null };
  }>;
}

async function checkTGWatcher(metrics: Awaited<ReturnType<typeof fetchVpsMetrics>>): Promise<HealthItem> {
  const wm = metrics.watermark;
  const ageS = wm.age_seconds;
  const val = wm.value;
  if (ageS === null) return { id: 'watcher', label: 'TG Watcher', status: 'red', detail: 'Watermark file missing', updatedAt: null };
  const ageH = ageS / 3600;
  const stale = val !== null && val >= 200000;
  let status: HealthStatus = ageH < 1 && !stale ? 'green' : ageH < 6 ? 'yellow' : 'red';
  const ageLabel = ageS < 60 ? Math.round(ageS) + 's' : ageS < 3600 ? Math.round(ageS / 60) + 'm' : (Math.round(ageH * 10) / 10) + 'h';
  const detail = stale ? 'Watermark stuck at ' + val : 'Watermark ' + val + ', updated ' + ageLabel + ' ago';
  return { id: 'watcher', label: 'TG Watcher', status, detail, updatedAt: wm.mtime_iso };
}

async function checkBradContext(metrics: Awaited<ReturnType<typeof fetchVpsMetrics>>): Promise<HealthItem> {
  const bc = metrics.brad_context;
  if (bc.age_seconds === null) return { id: 'brad-context', label: 'Brad Context', status: 'red', detail: 'File not found', updatedAt: null };
  const ageMin = bc.age_seconds / 60;
  const status: HealthStatus = ageMin < 10 ? 'green' : ageMin < 60 ? 'yellow' : 'red';
  const ageLabel = ageMin < 60 ? Math.round(ageMin) + 'm' : (Math.round(ageMin / 60 * 10) / 10) + 'h';
  return { id: 'brad-context', label: 'Brad Context', status, detail: 'Last generated ' + ageLabel + ' ago', updatedAt: bc.mtime_iso };
}

async function checkONNX(metrics: Awaited<ReturnType<typeof fetchVpsMetrics>>): Promise<HealthItem> {
  const onnx = metrics.onnx_index;
  if (onnx.age_seconds === null) return { id: 'onnx', label: 'ONNX Index', status: 'yellow', detail: 'Index not found', updatedAt: null };
  const ageH = onnx.age_seconds / 3600;
  const status: HealthStatus = ageH < 24 ? 'green' : ageH < 72 ? 'yellow' : 'red';
  const ageLabel = ageH < 1 ? Math.round(onnx.age_seconds / 60) + 'm' : (Math.round(ageH * 10) / 10) + 'h';
  return { id: 'onnx', label: 'ONNX Index', status, detail: 'Index ' + ageLabel + ' old', updatedAt: onnx.mtime_iso };
}

async function checkMCPanels(): Promise<HealthItem> {
  try {
    const today = todayET();
    const yest = yesterdayET();
    const tgToday = path.join(VAULT_CHATS, 'Hermes-TG - ' + today + '.md');
    const mcToday = path.join(VAULT_CHATS, 'Hermes-MC - ' + today + '.md');
    const tgYest  = path.join(VAULT_CHATS, 'Hermes-TG - ' + yest + '.md');
    const mcYest  = path.join(VAULT_CHATS, 'Hermes-MC - ' + yest + '.md');

    let tgSt: fs.Stats | null = null, mcSt: fs.Stats | null = null;
    let tgYS: fs.Stats | null = null, mcYS: fs.Stats | null = null;
    try { tgSt = fs.statSync(tgToday); } catch { /* missing */ }
    try { mcSt = fs.statSync(mcToday); } catch { /* missing */ }
    try { tgYS = fs.statSync(tgYest); } catch { /* missing */ }
    try { mcYS = fs.statSync(mcYest); } catch { /* missing */ }

    if (tgSt && mcSt) {
      const latest = new Date(Math.max(tgSt.mtimeMs, mcSt.mtimeMs));
      return { id: 'mc-panels', label: 'MC Panels', status: 'green', detail: 'Both panels active (' + today + ')', updatedAt: latest.toISOString() };
    }
    if (tgSt || mcSt) {
      const st = tgSt ?? mcSt!;
      const which = tgSt ? 'TG' : 'MC';
      return { id: 'mc-panels', label: 'MC Panels', status: 'yellow', detail: 'Only ' + which + ' panel found today', updatedAt: new Date(st.mtimeMs).toISOString() };
    }
    if (tgYS || mcYS) {
      const st = tgYS ?? mcYS!;
      return { id: 'mc-panels', label: 'MC Panels', status: 'yellow', detail: 'No panels today — yesterday present', updatedAt: new Date(st.mtimeMs).toISOString() };
    }
    return { id: 'mc-panels', label: 'MC Panels', status: 'red', detail: 'No panel files found', updatedAt: null };
  } catch (e: unknown) {
    return { id: 'mc-panels', label: 'MC Panels', status: 'red', detail: 'Error: ' + (e instanceof Error ? e.message : String(e)), updatedAt: null };
  }
}

async function checkPhone(metrics: Awaited<ReturnType<typeof fetchVpsMetrics>>): Promise<HealthItem> {
  try {
    const pi = metrics.phone_intake;
    if (!pi || pi.age_seconds === null) {
      return { id: 'phone', label: 'Phone', status: 'yellow', detail: 'No phone intake on VPS', updatedAt: null };
    }
    const ageH = pi.age_seconds / 3600;
    const status: HealthStatus = ageH < 8 ? 'green' : ageH < 24 ? 'yellow' : 'red';
    const ageLabel = ageH < 1 ? Math.round(pi.age_seconds / 60) + 'm' : (Math.round(ageH * 10) / 10) + 'h';
    const name = pi.name ? pi.name.replace('Intake-phone-', '').replace('.md', '') : 'unknown';
    return { id: 'phone', label: 'Phone', status, detail: name + ' (' + ageLabel + ' ago)', updatedAt: pi.mtime_iso };
  } catch (e: unknown) {
    return { id: 'phone', label: 'Phone', status: 'red', detail: 'Error: ' + (e instanceof Error ? e.message : String(e)), updatedAt: null };
  }
}

async function checkSessionReset(): Promise<HealthItem> {
  try {
    const res = await fetchNotes('/api/task-state', 4000);
    if (!res.ok) return { id: 'session-reset', label: 'Session Reset', status: 'red', detail: 'Endpoint unavailable', updatedAt: null };
    const data = await res.json() as { task_state?: { mtime_iso: string | null; age_seconds: number | null }; session_reset?: { mtime_iso: string | null; age_seconds: number | null; last_output?: string } };
    // silent-success cron: no output file written on success — use task_state mtime as proxy
    const sr = data.session_reset;
    const ts = data.task_state;
    if (sr?.last_output && /error|failed|exception/i.test(sr.last_output)) {
      return { id: 'session-reset', label: 'Session Reset', status: 'red', detail: 'Last run errored', updatedAt: sr.mtime_iso ?? null };
    }
    // Use task_state mtime as the reset cycle proxy (reset script always writes checkpoint first)
    if (!ts || ts.age_seconds === null) return { id: 'session-reset', label: 'Session Reset', status: 'unknown', detail: 'No checkpoint file', updatedAt: null };
    const ageMin = ts.age_seconds / 60;
    const status: HealthStatus = ageMin <= 70 ? 'green' : 'red';
    const ageLabel = ageMin < 60 ? Math.round(ageMin) + 'm ago' : (Math.round(ageMin / 60 * 10) / 10) + 'h ago';
    return { id: 'session-reset', label: 'Session Reset', status, detail: 'Last cycle ' + ageLabel, updatedAt: ts.mtime_iso };
  } catch (e: unknown) {
    return { id: 'session-reset', label: 'Session Reset', status: 'red', detail: 'Check failed: ' + (e instanceof Error ? e.message : String(e)), updatedAt: null };
  }
}

async function checkTaskState(): Promise<HealthItem> {
  try {
    const res = await fetchNotes('/api/task-state', 4000);
    if (!res.ok) return { id: 'task-state', label: 'Task State', status: 'red', detail: 'Endpoint unavailable', updatedAt: null };
    const data = await res.json() as { task_state?: { mtime_iso: string | null; age_seconds: number | null }; session_reset?: { mtime_iso: string | null; age_seconds: number | null } };
    const ts = data.task_state;
    if (!ts || ts.age_seconds === null) return { id: 'task-state', label: 'Task State', status: 'red', detail: 'File not found', updatedAt: null };
    const ageMin = ts.age_seconds / 60;
    const status: HealthStatus = ageMin <= 70 ? 'green' : ageMin <= 120 ? 'yellow' : 'red';
    const ageLabel = ageMin < 60 ? Math.round(ageMin) + 'm ago' : (Math.round(ageMin / 60 * 10) / 10) + 'h ago';
    return { id: 'task-state', label: 'Task State', status, detail: 'Updated ' + ageLabel, updatedAt: ts.mtime_iso };
  } catch (e: unknown) {
    return { id: 'task-state', label: 'Task State', status: 'red', detail: 'Check failed: ' + (e instanceof Error ? e.message : String(e)), updatedAt: null };
  }
}

const FALLBACK = (id: string, label: string): HealthItem => ({ id, label, status: 'red', detail: 'Check failed', updatedAt: null });

export async function GET() {
  // Fetch VPS metrics once (shared by watcher + brad-context + onnx checks)
  let vpsMetrics: Awaited<ReturnType<typeof fetchVpsMetrics>> | null = null;
  try { vpsMetrics = await fetchVpsMetrics(); } catch { /* will surface as unknown */ }

  const unknownVps = (id: string, label: string): HealthItem =>
    ({ id, label, status: 'unknown' as HealthStatus, detail: 'VPS metrics unavailable', updatedAt: null });

  const [vault, mcPanels, phone, sessionReset, taskState] = await Promise.all([
    checkVault().catch(() => FALLBACK('vault', 'Vault')),
    checkMCPanels().catch(() => FALLBACK('mc-panels', 'MC Panels')),
    vpsMetrics ? checkPhone(vpsMetrics).catch(() => FALLBACK('phone', 'Phone')) : unknownVps('phone', 'Phone'),
    checkSessionReset().catch(() => FALLBACK('session-reset', 'Session Reset')),
    checkTaskState().catch(() => FALLBACK('task-state', 'Task State')),
  ]);

  const watcher     = vpsMetrics ? await checkTGWatcher(vpsMetrics).catch(() => FALLBACK('watcher', 'TG Watcher')) : unknownVps('watcher', 'TG Watcher');
  const bradCtx     = vpsMetrics ? await checkBradContext(vpsMetrics).catch(() => FALLBACK('brad-context', 'Brad Context')) : unknownVps('brad-context', 'Brad Context');
  const onnx        = vpsMetrics ? await checkONNX(vpsMetrics).catch(() => FALLBACK('onnx', 'ONNX Index')) : unknownVps('onnx', 'ONNX Index');

  const items: HealthItem[] = [vault, watcher, bradCtx, onnx, mcPanels, phone, sessionReset, taskState];

  return NextResponse.json(items, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' },
  });
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const NOTES_URL = process.env.NOTES_SERVER_URL ?? 'http://31.220.63.57:9120';
  

  try {
    const res = await fetch(`${NOTES_URL}/api/cost`, {
      headers: {
        'x-notes-token': process.env.NOTES_TOKEN ?? "notes-wynneops-2026",
      },
    });

    if (!res.ok) {
      throw new Error(`Upstream responded with ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error, total: 0, limit: 5, providers: {} },
      { status: 502 }
    );
  }
}

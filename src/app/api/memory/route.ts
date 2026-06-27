import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const NOTES_URL = process.env.NOTES_SERVER_URL ?? 'http://31.220.63.57:9120';
  

  const q = request.nextUrl.searchParams.get('q');
  if (!q) {
    return NextResponse.json({ ok: false, error: 'q= required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${NOTES_URL}/api/memory?q=${encodeURIComponent(q)}`,
      {
        headers: {
          'x-notes-token': process.env.NOTES_TOKEN ?? "notes-wynneops-2026",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Upstream responded with ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }
}

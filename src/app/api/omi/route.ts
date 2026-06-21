import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIND_INSURANCE_URL = "https://app.wynneops.com";
const USER_ID = "8a5df513-41a2-4644-8865-38a357b17c77";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const tag = searchParams.get("tag") || "";
  const limit = searchParams.get("limit") || "10";

  const params = new URLSearchParams({ userId: USER_ID, limit });
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);

  try {
    const res = await fetch(
      `${MIND_INSURANCE_URL}/api/memories?${params.toString()}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return Response.json({ ok: true, ...data });
  } catch (err) {
    return Response.json(
      { memories: [], total: 0, error: String(err) },
      { status: 502 }
    );
  }
}

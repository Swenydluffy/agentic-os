import { NextRequest } from "next/server";
import { searchTweets, type TwitterErrorCode } from "@/lib/twitter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusForCode(code?: TwitterErrorCode): number {
  switch (code) {
    case "unconfigured":
      return 500;
    case "bad_query":
      return 400;
    case "auth":
      return 502;
    case "rate_limit":
      return 429;
    case "timeout":
      return 504;
    case "offline":
    case "protocol":
    default:
      return 502;
  }
}

/**
 * GET /api/twitter?q=<query>&max=<n>
 * Searches recent tweets via the X API v2 and returns flat tweet cards.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return Response.json({ ok: false, tweets: [], error: "Missing search query (?q=)." }, { status: 400 });
  }

  const maxRaw = Number(req.nextUrl.searchParams.get("max"));
  const max = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 25;

  const result = await searchTweets(q, max);
  return Response.json(result, { status: result.ok ? 200 : statusForCode(result.code) });
}

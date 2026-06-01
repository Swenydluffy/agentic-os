import { NextRequest } from "next/server";
import { queryOmi, OMI_TAGS, type OmiTag, type OmiErrorCode } from "@/lib/omi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusForCode(code?: OmiErrorCode): number {
  switch (code) {
    case "missing-file":
      return 404;
    case "read-error":
    default:
      return 500;
  }
}

/**
 * GET /api/omi?q=<text>&tag=<tag>&limit=<n>
 * Returns recent OMI memories (newest first) from the synced Obsidian export,
 * optionally filtered by free-text query and/or derived category tag.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || undefined;

  const tagParam = sp.get("tag")?.trim();
  const tag = OMI_TAGS.includes(tagParam as OmiTag) ? (tagParam as OmiTag) : undefined;

  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  const result = await queryOmi({ q, tag, limit });
  return Response.json(result, { status: result.ok ? 200 : statusForCode(result.code) });
}

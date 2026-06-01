import { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { resolveAssetPath, contentTypeFor } from "@/lib/notebook-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serve a downloaded notebook artifact from the vault's `_assets` folder, with
 * HTTP Range support so the Assets tab's <video>/<audio> elements can scrub.
 *
 *   GET /api/notebook/asset?notebook=<folder>&file=<filename>
 *
 * A `Range: bytes=…` request returns 206 Partial Content with `Content-Range`;
 * otherwise the whole file is streamed with `Accept-Ranges: bytes`. Paths are
 * resolved strictly inside `_assets` (see resolveAssetPath) — no traversal.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const folder = sp.get("notebook")?.trim() ?? "";
  const file = sp.get("file")?.trim() ?? "";

  const abs = resolveAssetPath(folder, file);
  if (!abs) return new Response("Invalid asset path.", { status: 400 });

  let size: number;
  try {
    const s = await stat(abs);
    if (!s.isFile()) return new Response("Not found.", { status: 404 });
    size = s.size;
  } catch {
    return new Response("Not found.", { status: 404 });
  }

  const contentType = contentTypeFor(extname(file).slice(1));
  const range = req.headers.get("range");
  const parsed = range ? parseRange(range, size) : null;

  // Malformed / unsatisfiable range → 416 with the valid extent.
  if (range && !parsed) {
    return new Response("Requested range not satisfiable.", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
    });
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
  };

  if (parsed) {
    const { start, end } = parsed;
    const chunkSize = end - start + 1;
    const stream = createReadStream(abs, { start, end });
    return new Response(toWebStream(stream), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(chunkSize),
      },
    });
  }

  const stream = createReadStream(abs);
  return new Response(toWebStream(stream), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}

/** Parse a single-range `bytes=start-end` header against the file size. */
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;

  let start: number;
  let end: number;
  if (rawStart === "") {
    // Suffix range: last N bytes.
    const suffix = Number(rawEnd);
    if (suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start < 0 || start >= size) return null;
  if (end >= size) end = size - 1;
  return { start, end };
}

/** Adapt a Node Readable to a Web ReadableStream for the Response body. */
function toWebStream(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
}

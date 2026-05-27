import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "@/lib/config.server";
import { writeGuide } from "@/lib/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guideSourcePath(): string {
  return join(process.cwd(), "src", "content", "guide.md");
}

/** Return the guide markdown (the in-app Guide page renders this). */
export async function GET() {
  try {
    const markdown = await readFile(guideSourcePath(), "utf8");
    return Response.json({ ok: true, markdown });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Write the guide into the configured Obsidian vault as Guide.md. */
export async function POST() {
  try {
    const markdown = await readFile(guideSourcePath(), "utf8");
    const { vault } = loadConfig();
    const result = await writeGuide(markdown, vault.path, vault.folder);
    return Response.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

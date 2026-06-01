/**
 * Tiny server-only JSON store for panel data that lives under the repo's
 * `data/` directory (e.g. data/memory.json, data/workflows.json). Reads return
 * a fallback when the file is missing or corrupt; writes are atomic-ish
 * (write + rename) so a crash can't leave a half-written file.
 *
 * Imported only by route handlers — never from the browser.
 */
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

/** Absolute path to a file inside the repo's data/ directory. */
function dataPath(file: string): string {
  return join(process.cwd(), "data", file);
}

/** Read and parse `data/<file>`, returning `fallback` if absent or invalid. */
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(dataPath(file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Persist `value` to `data/<file>` as pretty JSON (creating data/ if needed). */
export async function writeJson(file: string, value: unknown): Promise<void> {
  const abs = dataPath(file);
  await mkdir(dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  await rename(tmp, abs);
}

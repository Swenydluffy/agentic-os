/**
 * Pure, browser-safe normalizers that turn the `nlm` CLI's loosely-shaped JSON
 * into the view models the NotebookLM panel renders. The CLI's exact field names
 * vary by version, so every extractor is defensive: it tries a list of candidate
 * keys and always produces a usable id + title, falling back gracefully.
 */

export interface NotebookView {
  id: string;
  title: string;
  /** Short scalar fields worth showing as chips (e.g. source count, emoji). */
  meta: string[];
}

export interface SourceView {
  id: string;
  title: string;
  type?: string;
}

export interface ArtifactView {
  id: string;
  title: string;
  type?: string;
  status?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** First defined string value among the candidate keys. */
function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/**
 * Unwrap the array of items from whatever envelope the CLI used: a bare array,
 * or an object keyed by `notebooks` / `sources` / `artifacts` / `data` / `results`.
 */
function toArray(data: unknown, ...keys: string[]): Record<string, unknown>[] {
  let arr: unknown = data;
  if (isRecord(data)) {
    for (const k of [...keys, "data", "results", "items"]) {
      if (Array.isArray(data[k])) {
        arr = data[k];
        break;
      }
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.filter(isRecord);
}

const ID_KEYS = ["id", "notebook_id", "notebookId", "source_id", "sourceId", "artifact_id", "artifactId"];
const TITLE_KEYS = ["title", "name", "emoji_title", "display_name", "label"];

export function normalizeNotebooks(data: unknown): NotebookView[] {
  return toArray(data, "notebooks").map((o, i) => {
    const id = pickString(o, ID_KEYS) ?? `notebook-${i}`;
    const title = pickString(o, TITLE_KEYS) ?? id;
    const meta: string[] = [];
    const count = pickString(o, ["source_count", "sources", "num_sources"]);
    if (count) meta.push(`${count} sources`);
    const updated = pickString(o, ["updated", "last_modified", "modified", "updated_at"]);
    if (updated) meta.push(updated);
    return { id, title, meta };
  });
}

export function normalizeSources(data: unknown): SourceView[] {
  return toArray(data, "sources").map((o, i) => {
    const id = pickString(o, ID_KEYS) ?? `source-${i}`;
    const title = pickString(o, TITLE_KEYS) ?? id;
    const type = pickString(o, ["type", "source_type", "kind", "mime_type"]);
    return { id, title, type };
  });
}

export function normalizeArtifacts(data: unknown): ArtifactView[] {
  return toArray(data, "artifacts").map((o, i) => {
    const id = pickString(o, ID_KEYS) ?? `artifact-${i}`;
    const title = pickString(o, [...TITLE_KEYS, "type", "artifact_type"]) ?? id;
    const type = pickString(o, ["type", "artifact_type", "kind"]);
    const status = pickString(o, ["status", "state"]);
    return { id, title, type, status };
  });
}

/**
 * Extract a readable answer from the chat/query JSON, which may be a plain
 * string, `{ answer }`, `{ response }`, `{ text }`, or nested under `result`.
 */
export function extractAnswer(data: unknown): string {
  if (typeof data === "string") return data;
  if (isRecord(data)) {
    const direct = pickString(data, ["answer", "response", "text", "content", "message", "output"]);
    if (direct) return direct;
    if (isRecord(data.result)) {
      const nested = pickString(data.result, ["answer", "response", "text", "content"]);
      if (nested) return nested;
    }
  }
  return "";
}

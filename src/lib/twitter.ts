/**
 * Server-side client for the X (Twitter) API v2 recent-search endpoint
 * (server-only — never import from the browser).
 *
 * Auth is a single app-only **Bearer Token**, read from `process.env.X_BEARER_TOKEN`.
 * We hit `GET /2/tweets/search/recent`, expand the author so each tweet card can
 * show an avatar/username, and ask for the public metrics (likes/retweets).
 */

const SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent";

/** One tweet shaped for the panel's cards. */
export interface Tweet {
  id: string;
  text: string;
  createdAt: string | null;
  authorName: string;
  authorHandle: string;
  authorAvatar: string | null;
  likes: number;
  retweets: number;
  replies: number;
  url: string;
}

export interface TwitterSearchResult {
  ok: boolean;
  tweets: Tweet[];
  error?: string;
  /** Coarse failure category, mirrors the other panels' error codes. */
  code?: TwitterErrorCode;
}

export type TwitterErrorCode =
  | "unconfigured"
  | "auth"
  | "rate_limit"
  | "bad_query"
  | "timeout"
  | "offline"
  | "protocol";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Map the v2 search payload into flat `Tweet` cards, joining authors via `includes`. */
function parseTweets(data: unknown): Tweet[] {
  const root = asRecord(data);
  if (!root || !Array.isArray(root.data)) return [];

  const users = new Map<string, Record<string, unknown>>();
  const includes = asRecord(root.includes);
  if (includes && Array.isArray(includes.users)) {
    for (const u of includes.users) {
      const r = asRecord(u);
      if (r && typeof r.id === "string") users.set(r.id, r);
    }
  }

  const out: Tweet[] = [];
  for (const item of root.data) {
    const t = asRecord(item);
    if (!t || typeof t.id !== "string" || typeof t.text !== "string") continue;

    const author = typeof t.author_id === "string" ? users.get(t.author_id) : undefined;
    const handle = typeof author?.username === "string" ? author.username : "";
    const metrics = asRecord(t.public_metrics);

    out.push({
      id: t.id,
      text: t.text,
      createdAt: typeof t.created_at === "string" ? t.created_at : null,
      authorName: typeof author?.name === "string" ? author.name : handle || "Unknown",
      authorHandle: handle,
      authorAvatar: typeof author?.profile_image_url === "string" ? author.profile_image_url : null,
      likes: num(metrics?.like_count),
      retweets: num(metrics?.retweet_count),
      replies: num(metrics?.reply_count),
      url: handle ? `https://x.com/${handle}/status/${t.id}` : `https://x.com/i/web/status/${t.id}`,
    });
  }
  return out;
}

/**
 * Run a recent-search against the X API. Returns a result object rather than
 * throwing — `ok:false` with a `code`/`error` describes any failure so the
 * route handler can stay thin.
 */
export async function searchTweets(query: string, max = 25, timeoutMs = 12_000): Promise<TwitterSearchResult> {
  const token = process.env.X_BEARER_TOKEN?.trim();
  if (!token) {
    return { ok: false, tweets: [], code: "unconfigured", error: "X_BEARER_TOKEN is not set on the server." };
  }

  const q = query.trim();
  if (!q) return { ok: false, tweets: [], code: "bad_query", error: "Empty search query." };

  // X requires max_results between 10 and 100.
  const maxResults = Math.min(100, Math.max(10, max));
  const params = new URLSearchParams({
    query: q,
    max_results: String(maxResults),
    "tweet.fields": "created_at,public_metrics,author_id",
    expansions: "author_id",
    "user.fields": "name,username,profile_image_url",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, tweets: [], code: "auth", error: "X rejected the Bearer Token (401/403)." };
      }
      if (res.status === 429) {
        return { ok: false, tweets: [], code: "rate_limit", error: "X rate limit hit — try again shortly." };
      }
      if (res.status === 400) {
        const detail = asRecord(data)?.errors;
        const first = Array.isArray(detail) ? asRecord(detail[0])?.message : undefined;
        return { ok: false, tweets: [], code: "bad_query", error: typeof first === "string" ? first : "Invalid search query." };
      }
      return { ok: false, tweets: [], code: "protocol", error: `X API error (HTTP ${res.status}).` };
    }

    return { ok: true, tweets: parseTweets(data) };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, tweets: [], code: "timeout", error: "X API request timed out." };
    }
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, tweets: [], code: "offline", error: `Couldn't reach the X API: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

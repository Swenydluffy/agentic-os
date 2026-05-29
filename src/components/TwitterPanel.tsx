"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Hash,
  Search,
  X,
  Heart,
  Repeat2,
  MessageCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { Tweet, TwitterSearchResult } from "@/lib/twitter";

const ACCENT = "#60a5fa";

/** Compact relative-time, e.g. "3h", "2d". Falls back to a date for older posts. */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function TwitterPanel() {
  const [query, setQuery] = useState("");
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q || loading) return;

    // Auto-clear previous results so stale tweets never linger under a new query.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setTweets([]);
    setError(null);
    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(`/api/twitter?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      const data = (await res.json()) as TwitterSearchResult;
      if (data.ok) {
        setTweets(data.tweets);
      } else {
        setError(data.error ?? "Search failed.");
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError("Couldn't reach Mission Control API.");
    } finally {
      if (controllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [query, loading]);

  function clear() {
    controllerRef.current?.abort();
    setQuery("");
    setTweets([]);
    setError(null);
    setSearched(false);
  }

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${ACCENT}22`, color: ACCENT }}
          >
            <Hash size={18} />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-wide text-white">X Search</h2>
            <p className="text-xs text-[var(--color-ink-dim)]">
              Recent tweets by keyword, #hashtag, or @mention
            </p>
          </div>
        </div>
      </header>

      {/* Search bar */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 transition focus-within:border-white/25">
          <Search size={15} className="shrink-0 text-[var(--color-ink-faint)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              } else if (e.key === "Escape") {
                clear();
              }
            }}
            placeholder="Search X — e.g. #nextjs, @vercel, claude code…"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[var(--color-ink-faint)]"
          />
          {query && (
            <button
              onClick={clear}
              aria-label="Clear"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--color-ink-faint)] transition hover:text-white"
            >
              <X size={13} />
            </button>
          )}
          <button
            onClick={search}
            disabled={!query.trim() || loading}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#04060d] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Search
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="text-[10px] text-[var(--color-ink-faint)]">↵ to search · esc to clear</span>
          {tweets.length > 0 && (
            <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-[var(--color-ink-dim)]">
              {tweets.length} result{tweets.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {loading ? (
          <Centered>
            <Loader2 size={18} className="animate-spin text-[var(--color-ink-dim)]" />
            <span className="text-sm text-[var(--color-ink-dim)]">Searching X…</span>
          </Centered>
        ) : error ? (
          <Centered>
            <AlertTriangle size={18} className="text-[var(--color-danger)]" />
            <span className="max-w-sm text-center text-sm text-[var(--color-ink-dim)]">{error}</span>
          </Centered>
        ) : !searched ? (
          <Centered>
            <Hash size={18} className="text-[var(--color-ink-faint)]" />
            <span className="text-sm text-[var(--color-ink-dim)]">Search X to see recent tweets here.</span>
          </Centered>
        ) : tweets.length === 0 ? (
          <Centered>
            <Search size={18} className="text-[var(--color-ink-faint)]" />
            <span className="text-sm text-[var(--color-ink-dim)]">No tweets matched that search.</span>
          </Centered>
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {tweets.map((tweet) => (
                <TweetCard key={tweet.id} tweet={tweet} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- pieces ---------------------------------- */

function TweetCard({ tweet }: { tweet: Tweet }) {
  const age = relativeTime(tweet.createdAt);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18 }}
    >
      <a
        href={tweet.url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 transition hover:border-white/20 hover:bg-white/[0.05]"
      >
        <div className="flex items-center gap-2.5">
          <Avatar src={tweet.authorAvatar} name={tweet.authorName} />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-white">{tweet.authorName}</span>
            {tweet.authorHandle && (
              <span className="truncate text-xs text-[var(--color-ink-faint)]">@{tweet.authorHandle}</span>
            )}
          </div>
          {age && (
            <span className="ml-auto shrink-0 text-[11px] text-[var(--color-ink-faint)]" title={tweet.createdAt ?? ""}>
              {age}
            </span>
          )}
        </div>

        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-ink)]">
          {tweet.text}
        </p>

        <div className="mt-2.5 flex items-center gap-5 text-[11px] text-[var(--color-ink-faint)]">
          <Metric icon={<Heart size={12} />} value={tweet.likes} />
          <Metric icon={<Repeat2 size={13} />} value={tweet.retweets} />
          <Metric icon={<MessageCircle size={12} />} value={tweet.replies} />
        </div>
      </a>
    </motion.li>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- remote avatars from X's CDN, no loader needed
    return <img src={src} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-[#04060d]"
      style={{ background: ACCENT }}
    >
      {initial}
    </span>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      {compact(value)}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 py-12">{children}</div>;
}

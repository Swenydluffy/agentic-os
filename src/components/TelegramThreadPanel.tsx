"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import React from "react";

interface TgMessage {
  msg_id: number;
  sender: string;
  direction: "in" | "out";
  text: string;
  timestamp: string;
  ts: number;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return ""; }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  } catch { return ""; }
}

type ReactChild = React.ReactElement | string;

function applyInline(s: string): ReactChild[] {
  const result: ReactChild[] = [];
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      result.push(<strong key={result.length} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("`") && part.endsWith("`")) {
      result.push(
        <code key={result.length} style={{
          background: "rgba(0,0,0,0.3)", borderRadius: 3,
          padding: "1px 5px", fontSize: "0.88em", fontFamily: "monospace", letterSpacing: 0,
        }}>{part.slice(1, -1)}</code>
      );
    } else if (part) {
      result.push(part);
    }
  }
  return result;
}

function renderMd(raw: string): React.ReactElement {
  const lines = raw.split("\n");
  const els: React.ReactElement[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) { code.push(lines[i]); i++; }
      els.push(
        <pre key={els.length} style={{
          background: "rgba(0,0,0,0.4)", borderRadius: 6, padding: "8px 10px",
          fontSize: 11, overflowX: "auto", overflowY: "auto", maxHeight: "150px", whiteSpace: "pre-wrap", margin: "6px 0",
          fontFamily: "monospace", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)",
        }}>{code.join("\n")}</pre>
      );
      i++; continue;
    }
    const hm = line.match(/^#{1,3} (.+)$/);
    if (hm) {
      els.push(<div key={els.length} style={{ fontWeight: 700, fontSize: 13, marginTop: 8, marginBottom: 3, color: "#f1f5f9" }}>{applyInline(hm[1])}</div>);
      i++; continue;
    }
    const bm = line.match(/^[-\u2022*] (.+)$/);
    if (bm) {
      els.push(
        <div key={els.length} style={{ display: "flex", gap: 6, marginTop: 2, paddingLeft: 2 }}>
          <span style={{ flexShrink: 0, color: "#64748b", marginTop: 1 }}>\u2022</span>
          <span style={{ color: "#f1f5f9" }}>{applyInline(bm[1])}</span>
        </div>
      );
      i++; continue;
    }
    if (line.trim() === "") { els.push(<div key={els.length} style={{ height: 5 }} />); i++; continue; }
    els.push(<div key={els.length} style={{ lineHeight: 1.6, color: "#f8fafc" }}>{applyInline(line)}</div>);
    i++;
  }
  return <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>{els}</div>;
}

function isPlain(text: string): boolean {
  return text.length < 200 && !text.includes("\n") && !text.includes("**") && !text.includes("`") && !text.includes("##") && !/^[-\u2022*] /m.test(text);
}

// \u2500\u2500\u2500 Collapsible Hermes bubble body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function HermesBubbleBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const MAX_H = 300;
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsCollapse, setNeedsCollapse] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      setNeedsCollapse(contentRef.current.scrollHeight > MAX_H + 20);
    }
  }, [text]);

  const body = isPlain(text)
    ? <div style={{ fontSize: 15, lineHeight: 1.7, color: "#f8fafc" }}>{text}</div>
    : <div style={{ fontSize: 14.5, lineHeight: 1.65, color: "#f8fafc" }}>{renderMd(text)}</div>;

  if (!needsCollapse) {
    return <div ref={contentRef}>{body}</div>;
  }

  return (
    <div>
      <div
        ref={contentRef}
        style={{
          maxHeight: expanded ? undefined : MAX_H,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {body}
        {!expanded && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
            background: "linear-gradient(transparent, #1e2433)",
            pointerEvents: "none",
          }} />
        )}
      </div>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          marginTop: 6, fontSize: 11, color: "#60a5fa", background: "none",
          border: "none", cursor: "pointer", padding: "2px 0", fontWeight: 600,
        }}
      >
        {expanded ? "\u25b2 Show less" : "\u25bc Show more"}
      </button>
    </div>
  );
}

// \u2500\u2500\u2500 Main component \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
export function TelegramThreadPanel() {
  const [messages, setMessages] = useState<TgMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCountRef = useRef(0);
  const atBottomRef = useRef(true);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom < 80;
    atBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    setShowScrollBtn(false);
    setUnreadCount(0);
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/tg-messages", { cache: "no-store" });
      const data = await res.json();
      if (data.ok && Array.isArray(data.messages)) {
        setMessages(prev => {
          const serverIds = new Set(data.messages.map((m: TgMessage) => m.msg_id));
          const optimistics = prev.filter(m => m.msg_id > 1e12 && !serverIds.has(m.msg_id));
          return [...data.messages, ...optimistics];
        });
        setLastFetch(Date.now());
        setError(null);
      }
    } catch {
      setError("Connection lost");
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 5000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    const newCount = messages.length;
    if (newCount > prevCountRef.current) {
      const wasAtBottom = atBottomRef.current;
      const isFirstLoad = prevCountRef.current === 0;
      prevCountRef.current = newCount;
      if (wasAtBottom || isFirstLoad) {
        requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom(isFirstLoad ? "instant" : "smooth")));
      } else {
        // New messages arrived while scrolled up \u2014 show unread badge
        setUnreadCount(c => c + (newCount - (prevCountRef.current - (newCount - prevCountRef.current))));
      }
    }
  }, [messages, scrollToBottom]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const optimistic: TgMessage = {
      msg_id: Date.now(), sender: "Brad", direction: "in",
      text, timestamp: new Date().toISOString(), ts: Date.now() / 1000,
    };
    setMessages(prev => [...prev, optimistic]);
    // Always scroll to bottom when Brad sends — regardless of current scroll position
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }));
    try {
      const res = await fetch("/api/tg-send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessages(prev => prev.filter(m => m.msg_id !== optimistic.msg_id));
        setError("Send failed: " + (data.error ?? "unknown"));
      } else {
        setTimeout(fetchMessages, 3000);
      }
    } catch {
      setMessages(prev => prev.filter(m => m.msg_id !== optimistic.msg_id));
      setError("Send failed");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // Filter out clean cron runs — only show messages with failure signals
  const CRON_NOISE = /^(tg_message_logger|morning_brief|daily_brief|backup|sync|health.?check|vault.?sync|ping|heartbeat|scheduler|cron.*ok|cron.*done|cron.*success|cron.*complete|✅.*ran|ran.*successfully|completed.*successfully|no issues|all.*ok|everything.*ok|nothing.*new)/i;
  const FAILURE_SIGNALS = /failed|error|warning|warn|alert|not found|not running|down|blocked|exception|traceback|crash|unreachable|timeout|refused|denied|missing|invalid|broken|critical|fatal|abort|panic|no such|cannot|could not|unable/i;

  function isCronNoise(msg: TgMessage): boolean {
    // Never filter Brad's own messages or optimistic sends
    if (msg.direction === "in" || msg.msg_id > 1e12) return false;
    const t = msg.text;
    // Keep if it contains any failure signal
    if (FAILURE_SIGNALS.test(t)) return false;
    // Filter if it looks like a routine cron completion with no issues
    if (CRON_NOISE.test(t) && t.length < 300) return true;
    // Filter very short clean-looking Hermes status lines (e.g. "✅", "Done.", "OK")
    if (msg.direction === "out" && t.trim().length < 40 && /^[✅🟢✓☑️okOKdone\.]+$/i.test(t.trim())) return true;
    return false;
  }

  const visibleMessages = messages.filter(m => !isCronNoise(m));

  // Group by date
  const grouped: { date: string; msgs: TgMessage[] }[] = [];
  for (const msg of visibleMessages) {
    const d = formatDate(msg.timestamp);
    if (!grouped.length || grouped[grouped.length - 1].date !== d) {
      grouped.push({ date: d, msgs: [msg] });
    } else {
      grouped[grouped.length - 1].msgs.push(msg);
    }
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#0a0e17", borderLeft: "1px solid #1a2035",
      minWidth: 0, overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* \u2500\u2500 Header \u2500\u2500 */}
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid #1a2035", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(180deg, #0d1221 0%, #0a0e17 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.15)"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.2 }}>Telegram</div>
            <div style={{ fontSize: 10, color: error ? "#ef4444" : "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: error ? "#ef4444" : "#22c55e", display: "inline-block" }} />
              {error ? "disconnected" : "live \u00b7 5s sync"}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 10, color: "#374151" }}>
          {lastFetch ? new Date(lastFetch).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) : ""}
        </span>
      </div>

      {/* \u2500\u2500 Scroll area \u2500\u2500 */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: "auto", overflowX: "hidden",
          padding: "16px 12px 8px",
          display: "flex", flexDirection: "column",
        }}
      >
        {messages.length === 0 && !error && (
          <div style={{ textAlign: "center", color: "#374151", fontSize: 12, marginTop: 40 }}>
            No messages yet
          </div>
        )}
        {error && (
          <div style={{
            margin: "8px 0", padding: "8px 12px", borderRadius: 8, flexShrink: 0,
            background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11,
            border: "1px solid rgba(239,68,68,0.2)",
          }}>{error}</div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date pill */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "14px 0 10px",
            }}>
              <span style={{
                fontSize: 10, color: "#4b5563", background: "#111827",
                border: "1px solid #1f2937", borderRadius: 20,
                padding: "3px 10px", letterSpacing: "0.04em",
              }}>{date}</span>
            </div>

            {msgs.map((msg, idx) => {
              const isBrad = msg.direction === "in";
              const prevMsg = idx > 0 ? msgs[idx - 1] : null;
              const isNewSender = !prevMsg || prevMsg.direction !== msg.direction;

              return (
                <div key={msg.msg_id} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isBrad ? "flex-end" : "flex-start",
                  marginBottom: 3,
                  marginTop: isNewSender && idx > 0 ? 10 : 2,
                }}>
                  {/* Sender label \u2014 only on first bubble of a run, and only for Hermes */}
                  {isNewSender && !isBrad && (
                    <div style={{ fontSize: 10, color: "#60a5fa", marginBottom: 3, paddingLeft: 4, fontWeight: 600 }}>
                      Hermes
                    </div>
                  )}

                  <div style={{
                    maxWidth: isBrad ? "72%" : "88%",
                    padding: isBrad ? "9px 13px" : "10px 14px",
                    borderRadius: isBrad ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: isBrad ? "#2563eb" : "#1e2740",
                    border: isBrad ? "none" : "1px solid #374151",
                    color: isBrad ? "#ffffff" : "#f8fafc",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    boxShadow: isBrad
                      ? "0 2px 8px rgba(37,99,235,0.3)"
                      : "0 1px 4px rgba(0,0,0,0.4)",
                  }}>
                    {isBrad ? (
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{msg.text}</div>
                    ) : (
                      <HermesBubbleBody text={msg.text} />
                    )}
                    <div style={{
                      fontSize: 10, marginTop: 5, textAlign: "right",
                      color: isBrad ? "rgba(255,255,255,0.55)" : "#4b5563",
                    }}>
                      {formatTime(msg.timestamp)}
                      {isBrad && <span style={{ marginLeft: 4 }}>\u2713</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {/* \u2500\u2500 Scroll-to-bottom button \u2500\u2500 */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom("smooth")}
          style={{
            position: "fixed", bottom: 80, right: 20,
            width: 36, height: 36, borderRadius: "50%",
            background: "#1e3a5c", border: "1px solid #2563eb",
            color: "#60a5fa", fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 12px rgba(37,99,235,0.4)",
            transition: "all 0.15s",
            zIndex: 10,
          }}
        >
          {unreadCount > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : "\u2193"}
        </button>
      )}

      {/* \u2500\u2500 Input \u2500\u2500 */}
      <div style={{
        padding: "10px 12px", borderTop: "1px solid #1a2035", flexShrink: 0,
        display: "flex", gap: 8, alignItems: "center",
        background: "#0d1221",
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message via Telegram..."
          disabled={sending}
          style={{
            flex: 1, background: "#111827", border: "1px solid #1f2937",
            borderRadius: 22, padding: "8px 14px", fontSize: 13,
            color: "#f3f4f6", outline: "none", transition: "border-color 0.15s",
          }}
          onFocus={e => e.currentTarget.style.borderColor = "#2563eb"}
          onBlur={e => e.currentTarget.style.borderColor = "#1f2937"}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          style={{
            width: 36, height: 36, borderRadius: "50%", border: "none",
            background: input.trim() && !sending ? "#2563eb" : "#1f2937",
            color: input.trim() && !sending ? "#fff" : "#4b5563",
            cursor: input.trim() && !sending ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s", flexShrink: 0,
            boxShadow: input.trim() && !sending ? "0 2px 8px rgba(37,99,235,0.4)" : "none",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

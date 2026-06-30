"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch { return ""; }
}

// ─── Permanent fix: render markdown as React elements, never raw HTML ─────────
// This eliminates dangerouslySetInnerHTML entirely. No more <div>/<br/> mixing,
// no block-inside-inline conflicts, no regex-generated broken HTML structures.

type ReactChild = React.ReactElement | string;

function applyInlineToString(s: string): ReactChild[] {
  // Split on **bold**, `code` patterns and return React nodes
  const result: ReactChild[] = [];
  // Process bold first, then code, then plain text
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      result.push(
        <strong key={result.length} style={{ color: "#f0f6fc", fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    } else if (part.startsWith("`") && part.endsWith("`")) {
      result.push(
        <code key={result.length} style={{
          background: "#161b22", border: "1px solid #30363d", borderRadius: 3,
          padding: "1px 4px", fontSize: "0.9em", color: "#79c0ff", fontFamily: "monospace",
        }}>
          {part.slice(1, -1)}
        </code>
      );
    } else if (part) {
      result.push(part);
    }
  }
  return result;
}

function renderMarkdownToReact(raw: string): React.ReactElement {
  // Split into lines and render each as a proper React block element.
  // Code fences are handled as a block. No raw HTML anywhere.
  const lines = raw.split("\n");
  const elements: React.ReactElement[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={elements.length} style={{
          background: "#0d1117", border: "1px solid #30363d", borderRadius: 4,
          padding: "6px 8px", fontSize: 11, overflowX: "auto", whiteSpace: "pre-wrap",
          margin: "4px 0", color: "#e6edf3", fontFamily: "monospace",
        }}>
          {codeLines.join("\n")}
        </pre>
      );
      i++;
      continue;
    }

    // Header (## or ###)
    const hMatch = line.match(/^#{1,3} (.+)$/);
    if (hMatch) {
      elements.push(
        <div key={elements.length} style={{
          fontWeight: 700, fontSize: 13, color: "#f0f6fc",
          marginTop: 6, marginBottom: 2,
          borderBottom: "1px solid #21262d", paddingBottom: 2,
        }}>
          {applyInlineToString(hMatch[1])}
        </div>
      );
      i++;
      continue;
    }

    // Bullet line
    const bMatch = line.match(/^[-•*] (.+)$/);
    if (bMatch) {
      elements.push(
        <div key={elements.length} style={{
          display: "flex", gap: 6, marginTop: 1, marginBottom: 1,
          paddingLeft: 4, color: "#c9d1d9",
        }}>
          <span style={{ flexShrink: 0, color: "#6b7280" }}>•</span>
          <span>{applyInlineToString(bMatch[1])}</span>
        </div>
      );
      i++;
      continue;
    }

    // Empty line → small spacer
    if (line.trim() === "") {
      elements.push(<div key={elements.length} style={{ height: 4 }} />);
      i++;
      continue;
    }

    // Normal text line
    elements.push(
      <div key={elements.length} style={{ lineHeight: 1.55 }}>
        {applyInlineToString(line)}
      </div>
    );
    i++;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {elements}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TelegramThreadPanel() {
  const [messages, setMessages] = useState<TgMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevCountRef = useRef(0);

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

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      prevCountRef.current = messages.length;
    }
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");

    const optimistic: TgMessage = {
      msg_id: Date.now(),
      sender: "Brad",
      direction: "in",
      text,
      timestamp: new Date().toISOString(),
      ts: Date.now() / 1000,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const res = await fetch("/api/tg-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessages(prev => prev.filter(m => m.msg_id !== optimistic.msg_id));
        setError("Send failed: " + (data.error ?? "unknown"));
      } else {
        if (data.reply) {
          const hermesMsg: TgMessage = {
            msg_id: Date.now() + 1,
            sender: "Hermes",
            direction: "out",
            text: data.reply,
            timestamp: new Date().toISOString(),
            ts: Date.now() / 1000,
          };
          setMessages(prev => [...prev, hermesMsg]);
        }
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

  // Group messages by date
  const grouped: { date: string; msgs: TgMessage[] }[] = [];
  for (const msg of messages) {
    const d = formatDate(msg.timestamp);
    if (!grouped.length || grouped[grouped.length - 1].date !== d) {
      grouped.push({ date: d, msgs: [msg] });
    } else {
      grouped[grouped.length - 1].msgs.push(msg);
    }
  }

  // Is this message plain text (no markdown needed)?
  function isPlainText(text: string): boolean {
    return (
      text.length < 200 &&
      !text.includes("\n") &&
      !text.includes("**") &&
      !text.includes("`") &&
      !text.includes("##") &&
      !/^[-•*] /m.test(text)
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#0d1117", borderLeft: "1px solid #1f2937",
      minWidth: 0, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid #1f2937",
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: error ? "#ef4444" : "#22c55e",
            boxShadow: error ? "0 0 6px #ef4444" : "0 0 6px #22c55e",
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#f9fafb" }}>Telegram</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Medellin Lodging Agent</span>
        </div>
        <span style={{ fontSize: 10, color: "#374151" }}>
          {lastFetch ? new Date(lastFetch).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
        </span>
      </div>

      {/* Messages scroll area */}
      <div style={{
        flex: 1, overflowY: "auto", overflowX: "hidden",
        padding: "12px 12px 4px",
        display: "flex", flexDirection: "column",   // ← THIS is what was missing
      }}>
        {messages.length === 0 && !error && (
          <div style={{ textAlign: "center", color: "#374151", fontSize: 12, marginTop: 40 }}>
            No messages yet
          </div>
        )}
        {error && (
          <div style={{
            margin: "8px 0", padding: "6px 10px", borderRadius: 6, flexShrink: 0,
            background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11,
          }}>
            {error}
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date} style={{ display: "flex", flexDirection: "column" }}>
            {/* Date divider */}
            <div style={{
              textAlign: "center", margin: "10px 0 8px", flexShrink: 0,
              fontSize: 10, color: "#4b5563", letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              {date}
            </div>

            {/* Message bubbles */}
            {msgs.map((msg) => {
              const isOut = msg.direction === "out";
              return (
                <div key={msg.msg_id} style={{
                  display: "flex",
                  justifyContent: isOut ? "flex-start" : "flex-end",
                  marginBottom: 8,
                  flexShrink: 0,    // prevent bubbles from collapsing height
                  width: "100%",
                  minHeight: 0,
                }}>
                  <div style={{
                    maxWidth: "82%",
                    minWidth: 0,
                    padding: "7px 10px",
                    borderRadius: isOut ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                    background: isOut ? "#161b22" : "#1d3a5c",
                    border: isOut ? "1px solid #21262d" : "1px solid #1e3a5f",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    boxSizing: "border-box",
                  }}>
                    {/* Sender label */}
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                      color: isOut ? "#6b7280" : "#60a5fa",
                      marginBottom: 3, textTransform: "uppercase",
                    }}>
                      {msg.sender}
                    </div>

                    {/* Message body — React elements only, no dangerouslySetInnerHTML */}
                    {isPlainText(msg.text) ? (
                      <div style={{ fontSize: 13, color: "#e6edf3", lineHeight: 1.5 }}>
                        {msg.text}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#c9d1d9" }}>
                        {renderMarkdownToReact(msg.text)}
                      </div>
                    )}

                    {/* Timestamp */}
                    <div style={{ fontSize: 9, color: "#4b5563", textAlign: "right", marginTop: 3 }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "10px 12px", borderTop: "1px solid #1f2937", flexShrink: 0,
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Message Brad via Telegram..."
          disabled={sending}
          style={{
            flex: 1, background: "#111827", border: "1px solid #1f2937",
            borderRadius: 8, padding: "7px 10px", fontSize: 14,
            color: "#f3f4f6", outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          style={{
            width: 32, height: 32, borderRadius: 8, border: "none",
            background: input.trim() && !sending ? "#2563eb" : "#1f2937",
            color: input.trim() && !sending ? "#fff" : "#4b5563",
            cursor: input.trim() && !sending ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s", flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

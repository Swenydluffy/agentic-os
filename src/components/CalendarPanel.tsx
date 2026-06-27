import { useState, useEffect } from "react";

interface CalendarEvent {
  id?: string;
  title: string;
  date: string; // ISO date string or YYYY-MM-DD
  time?: string;
  description?: string;
  tags?: string[];
}

interface CalendarResponse {
  events?: CalendarEvent[];
}

// Group events by normalised date string (YYYY-MM-DD)
function groupByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const groups: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    const dateKey = event.date?.slice(0, 10) ?? "Unknown";
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(event);
  }
  return groups;
}

function formatDateLabel(dateStr: string): string {
  if (dateStr === "Unknown") return "Unknown Date";
  try {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.getTime() === today.getTime()) return "Today";
    if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
    if (d.getTime() === yesterday.getTime()) return "Yesterday";

    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateStr;
  }
}

export function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/calendar");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: CalendarResponse = await res.json();
        setEvents(json.events ?? []);
      } catch (e: any) {
        setError(e.message || "Failed to load calendar");
      } finally {
        setLoading(false);
      }
    };

    fetchCalendar();
  }, []);

  const grouped = groupByDate(events);
  // Sort date keys chronologically
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return a.localeCompare(b);
  });

  const styles = {
    panel: {
      background: "#0d1f17",
      color: "#e5e7eb",
      borderRadius: "12px",
      padding: "24px",
      fontFamily: "system-ui, sans-serif",
      border: "1px solid #1a3a2a",
      minWidth: "300px",
    } as React.CSSProperties,
    title: {
      fontSize: "13px",
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "#10b981",
      marginBottom: "20px",
    },
    errorBox: {
      background: "#2d1a1a",
      border: "1px solid #ef4444",
      borderRadius: "8px",
      padding: "12px",
      color: "#ef4444",
      fontSize: "13px",
    },
    loading: {
      color: "#10b981",
      fontSize: "13px",
      textAlign: "center" as const,
      padding: "32px 0",
    },
    empty: {
      textAlign: "center" as const,
      color: "#4b5563",
      padding: "32px 0",
      fontSize: "14px",
      lineHeight: 1.6,
    },
    dateGroup: {
      marginBottom: "20px",
    } as React.CSSProperties,
    dateBadge: {
      display: "inline-block",
      background: "#10b981",
      color: "#022c22",
      fontSize: "11px",
      fontWeight: 700,
      padding: "3px 10px",
      borderRadius: "999px",
      marginBottom: "10px",
      letterSpacing: "0.04em",
      textTransform: "uppercase" as const,
    },
    todayBadge: {
      display: "inline-block",
      background: "#059669",
      color: "#ffffff",
      fontSize: "11px",
      fontWeight: 700,
      padding: "3px 10px",
      borderRadius: "999px",
      marginBottom: "10px",
      letterSpacing: "0.04em",
      textTransform: "uppercase" as const,
    },
    eventCard: {
      background: "#0a1f16",
      border: "1px solid #1a3a2a",
      borderRadius: "8px",
      padding: "12px 14px",
      marginBottom: "8px",
      borderLeft: "3px solid #10b981",
    } as React.CSSProperties,
    eventTitle: {
      fontSize: "14px",
      fontWeight: 600,
      color: "#d1fae5",
      marginBottom: "4px",
    },
    eventTime: {
      fontSize: "12px",
      color: "#10b981",
      marginBottom: "4px",
      fontWeight: 500,
    },
    eventDesc: {
      fontSize: "12px",
      color: "#9ca3af",
      lineHeight: 1.5,
      overflow: "hidden",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical" as const,
    } as React.CSSProperties,
    tagsRow: {
      display: "flex",
      flexWrap: "wrap" as const,
      gap: "4px",
      marginTop: "6px",
    } as React.CSSProperties,
    tag: {
      fontSize: "10px",
      color: "#10b981",
      background: "rgba(16,185,129,0.1)",
      border: "1px solid rgba(16,185,129,0.3)",
      borderRadius: "4px",
      padding: "1px 6px",
    },
    count: {
      fontSize: "12px",
      color: "#6b7280",
      marginBottom: "16px",
    },
  };

  return (
    <div style={styles.panel}>
      <div style={styles.title}>📅 Obsidian Calendar</div>

      {loading && (
        <div style={styles.loading}>Loading calendar events…</div>
      )}

      {error && !loading && (
        <div style={styles.errorBox}>⚠ {error}</div>
      )}

      {!loading && !error && events.length === 0 && (
        <div style={styles.empty}>
          📭
          <br />
          No calendar events found in Obsidian vault
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <>
          <div style={styles.count}>
            {events.length} event{events.length !== 1 ? "s" : ""} across {sortedDates.length} date{sortedDates.length !== 1 ? "s" : ""}
          </div>

          {sortedDates.map((dateKey) => {
            const label = formatDateLabel(dateKey);
            const isToday = label === "Today";
            return (
              <div key={dateKey} style={styles.dateGroup}>
                <div style={isToday ? styles.todayBadge : styles.dateBadge}>
                  {label}
                </div>
                {grouped[dateKey].map((event, i) => (
                  <div key={event.id ?? i} style={styles.eventCard}>
                    <div style={styles.eventTitle}>{event.title}</div>
                    {event.time && (
                      <div style={styles.eventTime}>🕐 {event.time}</div>
                    )}
                    {event.description && (
                      <div style={styles.eventDesc}>{event.description}</div>
                    )}
                    {event.tags && event.tags.length > 0 && (
                      <div style={styles.tagsRow}>
                        {event.tags.map((tag) => (
                          <span key={tag} style={styles.tag}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

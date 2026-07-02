import { useState } from "react";
import { BackButton } from "@/components/BackButton";

interface MemoryResult {
  filename: string;
  snippet: string;
  score: number;
}

interface MemoryResponse {
  results?: MemoryResult[];
  raw?: string;
}

interface MemoryPalacePanelProps { onBack?: () => void; }
export function MemoryPalacePanel({ onBack }: MemoryPalacePanelProps = {}){
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryResult[]>([]);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setRawOutput(null);
    setSearched(true);

    try {
      const res = await fetch(`/api/memory?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      let json: MemoryResponse;

      try {
        json = JSON.parse(text);
      } catch {
        setRawOutput(text);
        setLoading(false);
        return;
      }

      if (json.results && Array.isArray(json.results)) {
        setResults(json.results);
      } else if (json.raw) {
        setRawOutput(json.raw);
      } else {
        setRawOutput(JSON.stringify(json, null, 2));
      }
    } catch (e: any) {
      setError(e.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const scoreColor = (score: number) => {
    if (score >= 0.8) return "#10b981";
    if (score >= 0.5) return "#f59e0b";
    return "#9ca3af";
  };

  const styles = {
    panel: {
      background: "#0f1f1a",
      color: "#e5e7eb",
      borderRadius: "12px",
      padding: "24px",
      fontFamily: "system-ui, sans-serif",
      border: "1px solid #1a3a2e",
      minWidth: "320px",
    } as React.CSSProperties,
    title: {
      fontSize: "13px",
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "#10b981",
      marginBottom: "16px",
    },
    searchRow: {
      display: "flex",
      gap: "8px",
      marginBottom: "20px",
    } as React.CSSProperties,
    input: {
      flex: 1,
      background: "#0a1a14",
      border: "1px solid #1a3a2e",
      borderRadius: "8px",
      padding: "8px 12px",
      color: "#e5e7eb",
      fontSize: "14px",
      outline: "none",
    } as React.CSSProperties,
    searchBtn: {
      background: "#10b981",
      border: "none",
      color: "#fff",
      borderRadius: "8px",
      padding: "8px 16px",
      fontSize: "14px",
      fontWeight: 600,
      cursor: "pointer",
      transition: "opacity 0.2s",
      opacity: loading ? 0.6 : 1,
    } as React.CSSProperties,
    errorBox: {
      background: "#2d1a1a",
      border: "1px solid #ef4444",
      borderRadius: "8px",
      padding: "12px",
      color: "#ef4444",
      fontSize: "13px",
      marginBottom: "12px",
    },
    resultCard: {
      background: "#0a1a14",
      border: "1px solid #1a3a2e",
      borderRadius: "8px",
      padding: "14px",
      marginBottom: "10px",
    } as React.CSSProperties,
    resultHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: "8px",
    } as React.CSSProperties,
    filename: {
      fontSize: "13px",
      fontWeight: 600,
      color: "#10b981",
      wordBreak: "break-word" as const,
      flex: 1,
      marginRight: "8px",
    },
    scoreBadge: (score: number) => ({
      fontSize: "11px",
      fontWeight: 700,
      color: scoreColor(score),
      background: "rgba(0,0,0,0.3)",
      border: `1px solid ${scoreColor(score)}`,
      borderRadius: "4px",
      padding: "2px 6px",
      whiteSpace: "nowrap" as const,
      flexShrink: 0,
    } as React.CSSProperties),
    snippet: {
      fontSize: "13px",
      color: "#9ca3af",
      lineHeight: 1.5,
      overflow: "hidden",
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical" as const,
    } as React.CSSProperties,
    rawBlock: {
      background: "#050f0c",
      border: "1px solid #1a3a2e",
      borderRadius: "8px",
      padding: "14px",
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#6ee7b7",
      overflowX: "auto" as const,
      whiteSpace: "pre-wrap" as const,
      wordBreak: "break-word" as const,
      maxHeight: "400px",
      overflowY: "auto" as const,
    } as React.CSSProperties,
    empty: {
      textAlign: "center" as const,
      color: "#4b5563",
      padding: "32px 0",
      fontSize: "14px",
    },
    loadingText: {
      color: "#10b981",
      fontSize: "13px",
      textAlign: "center" as const,
      padding: "20px 0",
    },
  };

  return (
    <div style={styles.panel}>
      {onBack && <div style={{padding:"10px 20px 0"}}><BackButton onBack={onBack} /></div>}
      <div style={styles.title}>🧠 Memory Palace</div>

      <div style={styles.searchRow}>
        <input
          style={styles.input}
          type="text"
          placeholder="Search memories…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          style={styles.searchBtn}
          onClick={handleSearch}
          disabled={loading || !query.trim()}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>

      {error && <div style={styles.errorBox}>⚠ {error}</div>}

      {loading && (
        <div style={styles.loadingText}>Searching memories…</div>
      )}

      {!loading && rawOutput !== null && (
        <>
          <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
            Raw output:
          </div>
          <pre style={styles.rawBlock}>{rawOutput}</pre>
        </>
      )}

      {!loading && results.length > 0 && (
        <>
          <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "10px" }}>
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </div>
          {results.map((r, i) => (
            <div key={i} style={styles.resultCard}>
              <div style={styles.resultHeader}>
                <div style={styles.filename}>{r.filename}</div>
                <div style={styles.scoreBadge(r.score)}>
                  {(r.score * 100).toFixed(0)}%
                </div>
              </div>
              <div style={styles.snippet}>{r.snippet}</div>
            </div>
          ))}
        </>
      )}

      {!loading && searched && results.length === 0 && rawOutput === null && !error && (
        <div style={styles.empty}>No memories matched "{query}"</div>
      )}

      {!searched && !loading && (
        <div style={styles.empty}>
          Enter a query to search the memory palace
        </div>
      )}
    </div>
  );
}

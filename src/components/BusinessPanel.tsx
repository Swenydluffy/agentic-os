import { useState, useEffect } from "react";

export type BusinessTool = {
  id: string;
  label: string;
  icon: string;
  script: string;
  description: string;
};

interface BusinessPanelProps {
  tool: BusinessTool;
}

export function BusinessPanel({ tool }: BusinessPanelProps) {
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runScript = async () => {
    if (!tool.script) return;
    setRunning(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/scripts/run?name=${encodeURIComponent(tool.script)}`
      );
      const text = await res.text();

      if (!res.ok) {
        setError(`HTTP ${res.status}: ${text}`);
        setOutput("");
      } else {
        // Try to pretty-print JSON, else keep raw text
        try {
          const json = JSON.parse(text);
          setOutput(JSON.stringify(json, null, 2));
        } catch {
          setOutput(text);
        }
        setLastRun(new Date());
      }
    } catch (e: any) {
      setError(e.message || "Script execution failed");
    } finally {
      setRunning(false);
    }
  };

  // Auto-run on mount if script is provided
  useEffect(() => {
    if (tool.script) {
      runScript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool.id]);

  const styles = {
    panel: {
      background: "#1a1a2e",
      color: "#e5e7eb",
      borderRadius: "12px",
      padding: "24px",
      fontFamily: "system-ui, sans-serif",
      border: "1px solid #2d2d4e",
      minWidth: "300px",
    } as React.CSSProperties,
    header: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      marginBottom: "6px",
    } as React.CSSProperties,
    icon: {
      fontSize: "28px",
      lineHeight: 1,
    },
    titleBlock: {
      flex: 1,
    },
    label: {
      fontSize: "16px",
      fontWeight: 700,
      color: "#f59e0b",
      marginBottom: "2px",
    },
    description: {
      fontSize: "12px",
      color: "#9ca3af",
      marginBottom: "16px",
      lineHeight: 1.5,
    },
    metaRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "14px",
    } as React.CSSProperties,
    scriptTag: {
      fontSize: "11px",
      color: "#6b7280",
      background: "#12122a",
      border: "1px solid #2d2d4e",
      borderRadius: "4px",
      padding: "2px 8px",
      fontFamily: "monospace",
    },
    runBtn: {
      background: running ? "#92400e" : "#f59e0b",
      border: "none",
      color: running ? "#fcd34d" : "#1a1a2e",
      borderRadius: "8px",
      padding: "8px 18px",
      fontSize: "13px",
      fontWeight: 700,
      cursor: running ? "not-allowed" : "pointer",
      transition: "background 0.2s",
      letterSpacing: "0.02em",
    } as React.CSSProperties,
    terminalBlock: {
      background: "#050510",
      border: "1px solid #2d2d4e",
      borderRadius: "8px",
      padding: "14px",
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: "12px",
      color: "#22d3ee",
      overflowX: "auto" as const,
      whiteSpace: "pre-wrap" as const,
      wordBreak: "break-word" as const,
      minHeight: "80px",
      maxHeight: "320px",
      overflowY: "auto" as const,
      lineHeight: 1.6,
    } as React.CSSProperties,
    errorBox: {
      background: "#2d1a1a",
      border: "1px solid #ef4444",
      borderRadius: "8px",
      padding: "12px",
      color: "#ef4444",
      fontSize: "13px",
      fontFamily: "monospace",
    },
    footer: {
      marginTop: "10px",
      fontSize: "11px",
      color: "#6b7280",
      textAlign: "right" as const,
    },
    runningDot: {
      display: "inline-block",
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: "#f59e0b",
      marginRight: "6px",
      animation: "pulse 1s infinite",
    },
    noScript: {
      fontSize: "13px",
      color: "#6b7280",
      fontStyle: "italic" as const,
      padding: "24px 0",
      textAlign: "center" as const,
    },
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.icon}>{tool.icon}</span>
        <div style={styles.titleBlock}>
          <div style={styles.label}>{tool.label}</div>
        </div>
      </div>

      <div style={styles.description}>{tool.description}</div>

      {tool.script ? (
        <>
          <div style={styles.metaRow}>
            <span style={styles.scriptTag}>{tool.script}</span>
            <button
              style={styles.runBtn}
              onClick={runScript}
              disabled={running}
            >
              {running ? (
                <>
                  <span style={styles.runningDot} />
                  Running…
                </>
              ) : (
                "▶ Run Script"
              )}
            </button>
          </div>

          {error && (
            <div style={styles.errorBox}>
              <strong>Error:</strong>
              <br />
              {error}
            </div>
          )}

          {!error && (output || running) && (
            <div style={styles.terminalBlock}>
              {running && !output
                ? "$ " + tool.script + "\n\nRunning…"
                : "$ " + tool.script + "\n\n" + output}
            </div>
          )}

          {lastRun && !running && (
            <div style={styles.footer}>
              Last run: {lastRun.toLocaleTimeString()}
            </div>
          )}
        </>
      ) : (
        <div style={styles.noScript}>No script configured for this tool.</div>
      )}
    </div>
  );
}

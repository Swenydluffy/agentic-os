"use client";
import { useState, useEffect } from "react";

export function TravelPanel() {
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [lastRun, setLastRun] = useState<string>("");
  const [scriptName, setScriptName] = useState<string>("travel_booking.py");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/travel");
      const data = await res.json();
      if (data.ok) {
        setOutput(data.output || "");
        setScriptName(data.script || "travel_booking.py");
      } else {
        setError(data.error || "Script returned an error");
        setOutput(data.output || "");
      }
      setLastRun(new Date().toLocaleTimeString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "#3b82f6" }}>✈️ Travel</h2>
          <p className="text-xs text-slate-400">{scriptName}{lastRun && ` · Last run: ${lastRun}`}</p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="px-4 py-2 rounded text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: "#3b82f6", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Running…" : "▶ Run"}
        </button>
      </div>
      {error && (
        <div className="text-red-400 text-sm px-3 py-2 rounded" style={{ backgroundColor: "#2a0a0a" }}>
          {error}
        </div>
      )}
      <pre
        className="flex-1 overflow-auto rounded-lg p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap"
        style={{ backgroundColor: "#0a0f1a", color: "#22d3ee", minHeight: "200px" }}
      >
        {loading ? "Running script…" : output || "Press Run to fetch travel data"}
      </pre>
    </div>
  );
}

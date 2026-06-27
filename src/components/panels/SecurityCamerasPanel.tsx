"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface SecurityCamerasPanelProps {
  bridgeStatus: "connected" | "offline" | "pending";
}

const PLACEHOLDER_CAMERAS = [
  { id: "cam-1", name: "Front Door" },
  { id: "cam-2", name: "Back Yard" },
  { id: "cam-3", name: "Garage" },
  { id: "cam-4", name: "Driveway" },
];

const PLACEHOLDER_ALERTS = [
  { id: "a1", camera: "Front Door", timestamp: "2026-06-25 08:14", thumbnail: null },
  { id: "a2", camera: "Driveway",   timestamp: "2026-06-25 07:52", thumbnail: null },
  { id: "a3", camera: "Back Yard",  timestamp: "2026-06-24 23:18", thumbnail: null },
];

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function SecurityCamerasPanel({ bridgeStatus }: SecurityCamerasPanelProps) {
  /* ---- Bridge-not-connected state --------------------------------- */
  if (bridgeStatus !== "connected") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-12 text-center">
        {/* Banner */}
        <div className="w-full max-w-lg rounded-2xl bg-yellow-500/10 border border-yellow-500/30 px-8 py-7 mb-6">
          <div className="text-4xl mb-3">📹</div>
          <h2 className="text-lg font-semibold text-yellow-300 mb-2">
            Mac Bridge Required
          </h2>
          <p className="text-white/70 text-sm leading-relaxed">
            Camera feed is unavailable until Mac Bridge is activated.
          </p>
        </div>

        {/* Status pill */}
        <div className="mb-6">
          {bridgeStatus === "pending" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 border border-blue-500/30 px-4 py-1.5 text-xs text-blue-300">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
              Bridge pending activation…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 border border-red-500/30 px-4 py-1.5 text-xs text-red-300">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Bridge offline
            </span>
          )}
        </div>

        {/* Setup instructions */}
        <div className="w-full max-w-lg rounded-xl bg-white/[0.04] border border-white/10 px-7 py-6 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
            Setup Instructions
          </p>
          <ol className="space-y-3">
            {[
              "Add SSH key to Mac",
              "Enable Remote Login (System Settings → General → Sharing)",
              "Mac Bridge activates automatically",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/70">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xs text-cyan-400 font-bold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-5 pt-5 border-t border-white/10">
            <a
              href="/system/settings"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium px-5 py-2.5 transition-colors"
            >
              ⚙️ Go to Settings
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Connected state -------------------------------------------- */
  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Top bar: filter controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
        <input
          type="date"
          className="rounded-lg bg-white/[0.06] border border-white/10 text-white/70 text-xs px-3 py-2 outline-none focus:border-cyan-500/50"
          aria-label="Start date"
        />
        <span className="text-white/30 text-xs">→</span>
        <input
          type="date"
          className="rounded-lg bg-white/[0.06] border border-white/10 text-white/70 text-xs px-3 py-2 outline-none focus:border-cyan-500/50"
          aria-label="End date"
        />
        <select className="rounded-lg bg-white/[0.06] border border-white/10 text-white/70 text-xs px-3 py-2 outline-none focus:border-cyan-500/50">
          <option value="">All Cameras</option>
          {PLACEHOLDER_CAMERAS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
          <input type="checkbox" className="accent-cyan-500" />
          Motion only
        </label>
      </div>

      {/* Main grid + sidebar */}
      <div className="flex gap-4">
        {/* Live feed grid — 2×2 */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          {PLACEHOLDER_CAMERAS.map((cam) => (
            <div
              key={cam.id}
              className="relative aspect-video rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-center overflow-hidden"
            >
              {/* Placeholder visual */}
              <div className="text-4xl opacity-20">📷</div>
              <p className="text-xs text-white/30 mt-2">No feed</p>
              {/* Camera label */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1.5">
                <p className="text-xs text-white/70 font-medium">{cam.name}</p>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 mr-1" />
                <span className="text-[10px] text-green-400">Live</span>
              </div>
            </div>
          ))}
        </div>

        {/* Motion alerts sidebar */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold px-1">
            Motion Alerts
          </p>
          {PLACEHOLDER_ALERTS.map((alert) => (
            <div
              key={alert.id}
              className="rounded-xl bg-white/[0.04] border border-white/10 p-3 flex gap-3 items-start"
            >
              {/* Thumbnail placeholder */}
              <div className="h-10 w-14 shrink-0 rounded-lg bg-black/50 flex items-center justify-center text-lg">
                🎞️
              </div>
              <div>
                <p className="text-xs text-white/80 font-medium">{alert.camera}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{alert.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clip viewer */}
      <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">
          Clip Viewer
        </p>
        <div className="flex gap-4">
          {/* Video player placeholder */}
          <div className="flex-1 aspect-video rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-center">
            <div className="text-5xl opacity-20">▶️</div>
            <p className="text-xs text-white/30 mt-2">Select a clip to play</p>
          </div>
          {/* Clip list */}
          <div className="w-48 shrink-0 flex flex-col gap-1.5 overflow-y-auto max-h-40">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                className="text-left rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-xs text-white/60 hover:bg-white/[0.07] transition-colors"
              >
                Clip {n} — Front Door
                <br />
                <span className="text-white/30 text-[10px]">2026-06-25 0{n + 6}:00</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";

/* ------------------------------------------------------------------ */
/*  PhotosPanel                                                         */
/* ------------------------------------------------------------------ */

export default function PhotosPanel() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Status card */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-6 py-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl shrink-0">🖼️</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-base mb-1">
              Photo Access Required
            </h2>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              Photo access requires either{" "}
              <strong className="text-white/80">Mac Bridge (SSH)</strong> or{" "}
              <strong className="text-white/80">iCloud Photos API</strong>.
            </p>
            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <a
                href="/system/settings"
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium px-4 py-2.5 transition-colors"
              >
                🔗 Activate Mac Bridge
              </a>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600/50 hover:bg-blue-600/70 border border-blue-500/30 text-white text-sm font-medium px-4 py-2.5 transition-colors cursor-not-allowed opacity-70"
                title="iCloud integration coming soon"
                disabled
              >
                ☁️ Connect iCloud
                <span className="text-[10px] text-blue-300 font-normal">soon</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search photos by face, location, date, or keyword"
          className="w-full rounded-xl bg-white/[0.04] border border-white/10 text-white/70 text-sm pl-10 pr-4 py-3 outline-none focus:border-cyan-500/40 placeholder:text-white/30 transition-colors"
        />
      </div>

      {/* Photo grid placeholder */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-3">
          Photo Library
        </p>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center gap-2"
            >
              <span className="text-3xl opacity-20">📷</span>
              <span className="text-[10px] text-white/20">No photo</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status message */}
      <div className="rounded-xl bg-white/[0.03] border border-white/10 px-5 py-4 flex items-center gap-3">
        <span className="text-xl shrink-0">💡</span>
        <p className="text-white/40 text-sm">
          Photos will appear here once Mac Bridge or iCloud is connected.
        </p>
      </div>
    </div>
  );
}

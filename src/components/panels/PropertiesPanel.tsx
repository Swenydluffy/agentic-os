"use client";

import React, { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface DashboardData {
  monthly_revenue?: number;
  monthly_expenses?: number;
  occupancy_rate?: number;
  upcoming_checkouts?: string[];
}

interface Property {
  id: string;
  name: string;
  address: string;
  dashboard_data?: DashboardData;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function OccupancyBar({ rate }: { rate: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(rate * 100)));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-white/40 mb-1">
        <span>Occupancy</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-cyan-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const d = property.dashboard_data ?? {};
  const revenue = d.monthly_revenue ?? 0;
  const expenses = d.monthly_expenses ?? 0;
  const net = revenue - expenses;
  const checkouts = d.upcoming_checkouts ?? [];

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 flex flex-col gap-3">
      {/* Header */}
      <div>
        <h3 className="text-white font-semibold text-base">{property.name}</h3>
        <p className="text-white/40 text-xs mt-0.5">{property.address}</p>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Revenue", value: revenue, color: "text-green-400" },
          { label: "Expenses", value: expenses, color: "text-red-400" },
          { label: "Net",     value: net,      color: net >= 0 ? "text-cyan-400" : "text-orange-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl bg-white/[0.03] border border-white/10 p-3 text-center">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-semibold mt-1 ${color}`}>
              ${value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Occupancy bar */}
      {d.occupancy_rate !== undefined && (
        <OccupancyBar rate={d.occupancy_rate} />
      )}

      {/* Upcoming checkouts */}
      {checkouts.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1.5">
            Upcoming Checkouts
          </p>
          <ul className="space-y-1">
            {checkouts.map((c, i) => (
              <li key={i} className="text-xs text-white/60 flex items-center gap-2">
                <span className="text-cyan-500">›</span> {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-white/10 flex justify-end">
        <button className="rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium px-4 py-2 transition-colors">
          + Add Booking
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                          */
/* ------------------------------------------------------------------ */

export default function PropertiesPanel() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/properties")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Property[]) => {
        setProperties(data ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  /* Loading */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        <p className="text-white/40 text-sm">Loading properties…</p>
      </div>
    );
  }

  /* Error / empty */
  if (error || properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 py-12 text-center gap-5">
        <div className="text-5xl">🏘️</div>
        <div className="max-w-sm">
          <p className="text-white/60 text-sm leading-relaxed">
            No properties configured yet.
            <br />
            Add properties to{" "}
            <code className="text-cyan-400 text-xs bg-white/[0.06] rounded px-1.5 py-0.5">
              /opt/data/data/properties.json
            </code>
          </p>
          {error && (
            <p className="mt-3 text-red-400 text-xs">Error: {error}</p>
          )}
        </div>
      </div>
    );
  }

  /* Data */
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-white font-semibold text-lg">Properties</h2>
        <span className="text-white/40 text-xs">{properties.length} propert{properties.length === 1 ? "y" : "ies"}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {properties.map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
    </div>
  );
}

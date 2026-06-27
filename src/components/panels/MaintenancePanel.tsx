"use client";

import React, { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface MaintenanceItem {
  id: string;
  title: string;
  due_date: string;
  priority: "low" | "medium" | "high" | "critical";
  completed?: boolean;
}

const PRIORITY_STYLES: Record<string, string> = {
  low:      "bg-green-500/15 text-green-400 border-green-500/30",
  medium:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  high:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}
    >
      {priority}
    </span>
  );
}

function TaskRow({
  item,
  onComplete,
}: {
  item: MaintenanceItem;
  onComplete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={item.completed ?? false}
        onChange={() => onComplete(item.id)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-cyan-500 shrink-0"
      />
      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${item.completed ? "line-through text-white/30" : "text-white/80"}`}>
          {item.title}
        </p>
        <p className="text-[10px] text-white/40 mt-0.5">Due: {item.due_date}</p>
      </div>
      {/* Priority */}
      <PriorityBadge priority={item.priority} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add-task inline form                                                */
/* ------------------------------------------------------------------ */

function AddTaskForm({ onAdd }: { onAdd: (item: Partial<MaintenanceItem>) => void }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/life-dashboard/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), due_date: dueDate, priority, section: "home_maintenance" }),
      });
      const data = await res.json();
      onAdd(data);
      setTitle("");
      setDueDate("");
      setPriority("medium");
    } catch {
      // silently handle; parent will re-fetch
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl bg-white/[0.04] border border-cyan-500/30 px-4 py-4 flex flex-col gap-3"
    >
      <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">New Task</p>
      <input
        type="text"
        placeholder="Task title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-lg bg-white/[0.06] border border-white/10 text-white/80 text-sm px-3 py-2 outline-none focus:border-cyan-500/50 placeholder:text-white/30"
        required
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="flex-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 text-sm px-3 py-2 outline-none focus:border-cyan-500/50"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className="rounded-lg bg-white/[0.06] border border-white/10 text-white/70 text-sm px-3 py-2 outline-none focus:border-cyan-500/50"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 transition-colors"
        >
          {submitting ? "Adding…" : "Add Task"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                          */
/* ------------------------------------------------------------------ */

export default function MaintenancePanel() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/life-dashboard")
      .then((res) => res.json())
      .then((data) => {
        // Expect data to contain a home_maintenance array
        const tasks: MaintenanceItem[] =
          data?.home_maintenance ?? data?.sections?.home_maintenance?.items ?? [];
        setItems(tasks);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleComplete = async (id: string) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
    try {
      await fetch("/api/life-dashboard/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // revert on error
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item
        )
      );
    }
  };

  const handleAdd = (newItem: Partial<MaintenanceItem>) => {
    setShowForm(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">Home Maintenance</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium px-4 py-2 transition-colors"
        >
          {showForm ? "✕ Cancel" : "+ Add Task"}
        </button>
      </div>

      {/* Inline form */}
      {showForm && <AddTaskForm onAdd={handleAdd} />}

      {/* Task list */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-white/50 text-sm">No maintenance tasks. Great job! ✔</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <TaskRow key={item.id} item={item} onComplete={handleComplete} />
          ))}
        </div>
      )}
    </div>
  );
}

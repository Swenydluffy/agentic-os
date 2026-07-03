"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Skull } from "lucide-react";
import { useState } from "react";

type StopButtonState = "idle" | "confirming" | "loading" | "success" | "error";

interface StopButtonProps {
  authToken?: string;
}

export function StopButton({ authToken }: StopButtonProps) {
  const [state, setState] = useState<StopButtonState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    setState("loading");
    setErrorMsg("");

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      // If auth token is provided, include it in Authorization header
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      const response = await fetch("/api/gateway/kill", {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.text().catch(() => "Unknown error");
        setErrorMsg(`HTTP ${response.status}: ${errorData}`);
        setState("error");

        // Auto-reset to idle after 3 seconds
        setTimeout(() => setState("idle"), 3000);
        return;
      }

      setState("success");

      // Auto-reset to idle after 2 seconds
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(message);
      setState("error");

      // Auto-reset to idle after 3 seconds
      setTimeout(() => setState("idle"), 3000);
    }
  };

  const handleClickButton = () => {
    if (state === "idle") {
      setState("confirming");
    }
  };

  const handleCancel = () => {
    setState("idle");
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* PANIC Button */}
      <motion.button
        animate={state === "idle" ? { boxShadow: [
          "0 0 12px rgba(239,68,68,0.2)",
          "0 0 24px rgba(239,68,68,0.4)",
          "0 0 12px rgba(239,68,68,0.2)"
        ] } : {}}
        transition={state === "idle" ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" } : {}}
        type="button"
        onClick={handleClickButton}
        disabled={state !== "idle"}
        title="Emergency PANIC · Kills all gateway"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          borderRadius: 8,
          border: "1.5px solid",
          borderColor: state === "success" ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.4)",
          background:
            state === "success"
              ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))"
              : state === "error"
                ? "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))"
                : state === "loading"
                  ? "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))"
                  : "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.12))",
          backgroundImage:
            state === "success"
              ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))"
              : state === "error"
                ? "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))"
                : state === "loading"
                  ? "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))"
                  : "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.12))",
          color: state === "success" ? "#22c55e" : state === "error" ? "#ef4444" : "#ef4444",
          fontSize: 11,
          fontWeight: 700,
          cursor: state === "idle" ? "pointer" : "not-allowed",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: state === "loading" ? 0.8 : 1,
          boxShadow:
            state === "success"
              ? "0 0 16px rgba(34,197,94,0.3), inset 0 0 8px rgba(34,197,94,0.1)"
              : state === "error"
                ? "0 0 12px rgba(239,68,68,0.25)"
                : state === "loading"
                  ? "0 0 20px rgba(239,68,68,0.35), inset 0 0 8px rgba(239,68,68,0.1), 0 0 40px rgba(239,68,68,0.2)"
                  : "0 0 12px rgba(239,68,68,0.2)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          pointerEvents: state === "idle" || state === "confirming" ? "auto" : "none",
        }}
        onMouseEnter={(e) => {
          if (state === "idle") {
            e.currentTarget.style.borderColor = "rgba(239,68,68,0.6)";
            e.currentTarget.style.boxShadow = "0 0 24px rgba(239,68,68,0.4)";
          }
        }}
        onMouseLeave={(e) => {
          if (state === "idle") {
            e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
            e.currentTarget.style.boxShadow = "0 0 12px rgba(239,68,68,0.2)";
          }
        }}
      >
        {/* Power Icon with rotation on loading */}
        <motion.div
          animate={state === "loading" ? { rotate: 360 } : { rotate: 0 }}
          transition={state === "loading" ? { duration: 2, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
          style={{ display: "flex", alignItems: "center" }}
        >
          <Skull
            size={12}
            style={{
              flexShrink: 0,
              fill: state === "success" ? "#22c55e" : state === "error" ? "#ef4444" : "none",
            }}
          />
        </motion.div>

        {/* Text state indicator */}
        <span>
          {state === "loading" ? "PANICKING…" : state === "success" ? "HALTED" : state === "error" ? "ERROR" : "PANIC"}
        </span>
      </motion.button>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {state === "confirming" && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCancel}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(2px)",
                zIndex: 9998,
              }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 9999,
                background: "#0d1117",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 12,
                padding: "24px 28px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(239,68,68,0.15)",
                minWidth: 300,
                maxWidth: 420,
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(239,68,68,0.1)",
                  border: "2px solid rgba(239,68,68,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Skull size={24} style={{ color: "#ef4444" }} />
              </div>

              {/* Title */}
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: 8,
                  letterSpacing: "0.02em",
                }}
              >
                PANIC — Kill Gateway
              </h2>

              {/* Description */}
              <p
                style={{
                  fontSize: 13,
                  color: "#c4b5fd",
                  lineHeight: 1.5,
                  marginBottom: 20,
                }}
              >
                This will immediately kill all running agents and terminate the gateway. This action cannot be undone.
              </p>

              {/* Warning box */}
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginBottom: 22,
                  fontSize: 12,
                  color: "#fca5a5",
                  lineHeight: 1.4,
                }}
              >
                <strong>Warning:</strong> All in-flight processes will be terminated. Agent state will not be saved.
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                {/* Cancel button */}
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#e5e7eb",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0,0,0,0.3)";
                  }}
                >
                  Cancel
                </button>

                {/* Confirm button */}
                <button
                  type="button"
                  onClick={handleConfirm}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid rgba(239,68,68,0.4)",
                    background: "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.15))",
                    color: "#fca5a5",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    letterSpacing: "0.05em",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.6)";
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(239,68,68,0.35), rgba(220,38,38,0.25))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
                    e.currentTarget.style.background = "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.15))";
                  }}
                >
                  CONFIRM PANIC
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Error Toast (shows briefly if error occurs) */}
      <AnimatePresence>
        {state === "error" && errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              bottom: 20,
              right: 20,
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              padding: "12px 14px",
              fontSize: 12,
              color: "#fca5a5",
              zIndex: 10000,
              maxWidth: 300,
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}
          >
            <strong>Error:</strong> {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


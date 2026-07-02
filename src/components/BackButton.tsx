"use client";

interface BackButtonProps {
  onBack: () => void;
  label?: string;
}

export function BackButton({ onBack, label = "← Dashboard" }: BackButtonProps) {
  return (
    <button
      onClick={onBack}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 14px",
        borderRadius: 8,
        border: "1px solid #1f2937",
        background: "#0d1117",
        color: "#9ca3af",
        fontSize: 12,
        cursor: "pointer",
        marginBottom: 10,
        flexShrink: 0,
        transition: "all 0.12s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#374151";
        (e.currentTarget as HTMLButtonElement).style.color = "#f9fafb";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#1f2937";
        (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af";
      }}
    >
      {label}
    </button>
  );
}

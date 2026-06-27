"use client";
import { useCallback, useEffect, useRef } from "react";

interface Props {
  onDrag: (deltaX: number) => void;
}

export function ResizableDivider({ onDrag }: Props) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  // Keep onDrag in a ref so the stable mousemove listener always calls the latest version
  const onDragRef = useRef(onDrag);
  useEffect(() => { onDragRef.current = onDrag; }, [onDrag]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
  }, []);

  // Register once — reads onDragRef.current on every move
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDragRef.current(delta);
    }
    function onMouseUp() { dragging.current = false; }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []); // empty deps — stable listener, reads ref

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 6,
        flexShrink: 0,
        cursor: "col-resize",
        background: "transparent",
        borderLeft: "1px solid #1f2937",
        borderRight: "1px solid #1f2937",
        transition: "background 0.15s",
        userSelect: "none",
        zIndex: 10,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "#374151")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    />
  );
}

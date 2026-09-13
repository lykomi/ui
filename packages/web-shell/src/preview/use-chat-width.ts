import { useEffect, useRef, useState } from "react";

const WIDTH_KEY = "foundry.workbench-preview.chat-width";
const MIN_WIDTH = 360;
const CONTENT_MIN = 440;
export function chatWidthLimits(available: number) {
  const max = Math.max(MIN_WIDTH, Math.min(640, available - CONTENT_MIN));
  return {
    min: MIN_WIDTH,
    max,
    defaultWidth: Math.min(max, Math.max(MIN_WIDTH, Math.min(420, Math.round(available * 0.36)))),
  };
}
export function useChatWidth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(1000);
  const [preferred, setPreferred] = useState<number | null>(() => {
    try {
      const stored = Number(localStorage.getItem(WIDTH_KEY));
      return Number.isFinite(stored) && stored >= MIN_WIDTH ? Math.min(stored, 640) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      if (node.clientWidth > 0) setAvailable(node.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const limits = chatWidthLimits(available);
  const width = Math.min(limits.max, Math.max(limits.min, preferred ?? limits.defaultWidth));
  const setWidth = (value: number | null) => {
    const next = value === null ? null : Math.max(limits.min, Math.min(limits.max, value));
    setPreferred(next);
    try {
      if (next === null) localStorage.removeItem(WIDTH_KEY);
      else localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      /* Storage may be disabled. */
    }
  };
  return { containerRef, width, setWidth, compact: available < MIN_WIDTH + CONTENT_MIN, ...limits };
}

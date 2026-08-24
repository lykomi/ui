/**
 * The listening/speaking indicator: concentric rings breathing with the
 * audio level.
 *
 * Three things it does that a canvas visualiser usually gets wrong:
 *
 * - **It wears the theme, and notices when the theme changes.** Colours are
 *   read from the app's CSS custom properties (`--primary`,
 *   `--muted-foreground`) rather than baked in, and re-read when the root
 *   element's theme attributes change or the OS colour scheme flips — a
 *   canvas cannot inherit a CSS variable the way a DOM node does, so it has
 *   to watch for itself. Opacity comes from `globalAlpha`, not from building
 *   `rgba()` strings, so any colour format the design system uses — `oklch`,
 *   `hsl`, hex — works untouched.
 * - **It matches the device.** The backing store is sized in device pixels
 *   and scaled, so the rings are not soft on a retina display; a
 *   `ResizeObserver` keeps that true when the pane is resized.
 * - **It stops.** No analyser, a hidden tab, or `prefers-reduced-motion` and
 *   the animation loop is not running at all — a decorative
 *   `requestAnimationFrame` that never yields is a battery drain on a page
 *   people leave open.
 */

import { useEffect, useRef } from "react";

/** Rings drawn outward from the core. */
const RING_COUNT = 5;
const RING_GAP = 22;
const CORE_RADIUS = 20;

/**
 * Level smoothing, asymmetric on purpose.
 *
 * A single factor tracks speech syllable-for-syllable and the rings punch in
 * and out on every one — a thud rather than a presence. Rising quickly and
 * falling slowly turns the same signal into a swell that follows the shape
 * of a phrase instead of its consonants.
 */
const ATTACK = 0.09;
const RELEASE = 0.035;

/**
 * How far the rings travel at full level, in px.
 *
 * Deliberately small. The eye reads a gentle change as "alive"; a large one
 * as an alarm, and at speech rates it is simply hectic.
 */
const SWELL = 14;

export interface VoiceVisualizerProps {
  /** Analyser from the live session; `null` renders the idle state. */
  analyser: AnalyserNode | null;
  /**
   * Extra re-read trigger for theme systems the built-in observation cannot
   * see (root attributes and the OS scheme are watched automatically).
   */
  themeKey?: string;
  className?: string;
  /** Accessible description of what the animation represents. */
  label?: string;
}

function readColors(el: HTMLElement) {
  const style = getComputedStyle(el);
  const primary = style.getPropertyValue("--primary").trim();
  const muted = style.getPropertyValue("--muted-foreground").trim();
  return {
    // A theme that defines neither still gets something visible.
    active: primary || "currentColor",
    idle: muted || "currentColor",
  };
}

export function VoiceVisualizer({
  analyser,
  themeKey,
  className,
  label = "Voice activity",
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let colors = readColors(canvas);
    let level = 0;
    let frame: number | null = null;

    // Device pixels, so the strokes are crisp rather than upscaled.
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const buffer = analyser ? new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)) : null;

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const cx = width / 2;
      const cy = height / 2;

      if (analyser && buffer) {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i]!;
        const next = sum / buffer.length / 255;
        level += (next - level) * (next > level ? ATTACK : RELEASE);
      } else {
        level += (0 - level) * RELEASE;
      }

      // Transparent: the surface behind decides the background, which is what
      // makes this usable on a card, a panel, or a full-bleed stage.
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = analyser ? colors.active : colors.idle;
      ctx.fillStyle = analyser ? colors.active : colors.idle;

      for (let i = 0; i < RING_COUNT; i++) {
        const radius = CORE_RADIUS + i * RING_GAP + level * SWELL;
        const alpha = Math.max(0, 0.45 - i * 0.09);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.5 + level * 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 0.32 + level * 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy, CORE_RADIUS * (0.9 + level * 0.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    if (reducedMotion || !analyser) {
      // One static frame: the shape is still meaningful as a state icon.
      draw();
    } else {
      const loop = () => {
        draw();
        frame = requestAnimationFrame(loop);
      };
      loop();
    }

    // A background tab throttles rAF to a crawl; stop rather than limp.
    const onVisibility = () => {
      if (document.hidden && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      } else if (!document.hidden && frame === null && !reducedMotion && analyser) {
        const loop = () => {
          draw();
          frame = requestAnimationFrame(loop);
        };
        loop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // The theme can change without this component re-rendering: a class or
    // data-theme flip on <html>, or the OS scheme changing while the app is
    // on "system". Painted pixels do not update with a CSS variable, so
    // watch both and repaint the static frame when the loop is not running.
    const refreshColors = () => {
      colors = readColors(canvas);
      if (frame === null) draw();
    };
    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    scheme?.addEventListener?.("change", refreshColors);
    const themeObserver = new MutationObserver(refreshColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
    refreshColors();

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      themeObserver.disconnect();
      scheme?.removeEventListener?.("change", refreshColors);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [analyser, themeKey]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={className ?? "h-48 w-full max-w-md"}
    />
  );
}

/**
 * The avatar key, checked against the shader instead of by eye.
 *
 * Looking at a rendered avatar is a bad way to tune this: "a bit washed out"
 * and "correctly semi-transparent at the edges" look similar in a small
 * preview, and the failure that shipped — every subject colour at 43–72%
 * opacity, the whole figure a ghost with a halo — was arrived at by eye while
 * trying to soften a green fringe.
 *
 * The SDK's fragment shader is small enough to restate exactly:
 *
 *     yuv       = rgb2yuv(pixel)
 *     d         = distance(yuv.uv, rgb2yuv(keyColor).uv)
 *     alpha     = smoothstep(similarity, similarity + smoothness, d)
 *
 * Restating it is the point. These tests then say what the key must DO —
 * subject opaque, background gone, edge tight — rather than pinning the two
 * magic numbers, so a future retune is free to move them and is only stopped
 * if it breaks one of those three properties.
 */
import { describe, expect, it } from "vitest";
import { AVATAR_CHROMA_KEY } from "../react/voice-avatar.tsx";

type Rgb = [number, number, number];

function rgbToYuv([r, g, b]: Rgb): [number, number, number] {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return [y, (b - y) * 0.565, (r - y) * 0.713];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Alpha the SDK's shader produces for one pixel under the shipped config. */
function alphaOf(pixel: Rgb): number {
  const { keyColor, similarity, smoothness } = AVATAR_CHROMA_KEY;
  const [, ku, kv] = rgbToYuv(keyColor as Rgb);
  const [, u, v] = rgbToYuv(pixel);
  return smoothstep(similarity, similarity + smoothness, Math.hypot(u - ku, v - kv));
}

/** Representative avatar pixels. White and light grey sit CLOSEST to green. */
const SUBJECT: Record<string, Rgb> = {
  "lit skin": [0.94, 0.76, 0.68],
  "mid skin": [0.85, 0.65, 0.55],
  "shadowed skin": [0.55, 0.4, 0.35],
  "grey t-shirt": [0.6, 0.6, 0.62],
  "dark hair": [0.25, 0.2, 0.18],
  "blue jeans": [0.35, 0.45, 0.65],
  lips: [0.75, 0.25, 0.3],
  "white garment": [1, 1, 1],
  "off-white": [0.9, 0.9, 0.95],
  "near-black": [0.15, 0.15, 0.17],
};

/** An edge pixel: `fraction` of the subject blended with the green screen. */
function edgePixel(fraction: number): Rgb {
  const skin = SUBJECT["mid skin"]!;
  return [0, 1, 0].map((g, i) => g * (1 - fraction) + skin[i]! * fraction) as Rgb;
}

describe("avatar chroma key", () => {
  it("leaves every subject colour fully opaque", () => {
    // The shipped bug: the top of the smoothstep reached past d ≈ 0.53, where
    // white and light grey live, so the subject itself was being feathered.
    for (const [name, rgb] of Object.entries(SUBJECT)) {
      expect(alphaOf(rgb), `${name} must not be transparent`).toBeCloseTo(1, 3);
    }
  });

  it("keeps the smoothstep ceiling below the nearest subject colour", () => {
    // Says the same thing structurally, so the reason survives even if the
    // sample colours above are ever revised.
    const nearest = Math.min(
      ...Object.values(SUBJECT).map((rgb) => {
        const [, ku, kv] = rgbToYuv(AVATAR_CHROMA_KEY.keyColor as Rgb);
        const [, u, v] = rgbToYuv(rgb);
        return Math.hypot(u - ku, v - kv);
      }),
    );
    expect(AVATAR_CHROMA_KEY.similarity + AVATAR_CHROMA_KEY.smoothness).toBeLessThan(nearest);
  });

  it("removes the green screen completely", () => {
    expect(alphaOf([0, 1, 0])).toBe(0);
    expect(alphaOf([0.05, 0.95, 0.05])).toBe(0);
  });

  it("cuts the edge tightly enough to leave no green fringe", () => {
    // A pixel that is 80% subject still carries 20% green. The SDK default
    // leaves it at 0.73 — mostly opaque, and visibly green at the silhouette.
    expect(alphaOf(edgePixel(0.7))).toBeLessThan(0.1);
    expect(alphaOf(edgePixel(0.8))).toBeLessThan(0.4);
  });

  it("still resolves to the subject just inside the edge", () => {
    // The other side of the same trade: cut too hard and the outline erodes.
    expect(alphaOf(edgePixel(0.95))).toBeGreaterThan(0.9);
  });
});

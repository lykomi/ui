import { describe, expect, it } from "vitest";
import { hasAnyDropTarget, hasExternalFilesData } from "../nav-dnd";

describe("nav-dnd helpers", () => {
  it("detects external file drags from Files type alone", () => {
    expect(
      hasExternalFilesData({
        types: ["Files"],
        files: { length: 0 },
      }),
    ).toBe(true);
  });

  it("treats file-only targets as active drop targets", () => {
    expect(hasAnyDropTarget(false, true)).toBe(true);
    expect(hasAnyDropTarget(true, false)).toBe(true);
    expect(hasAnyDropTarget(false, false)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  applyProjectEdit,
  initialProject,
  projectErrors,
} from "../../template/src/showcase/form-model.ts";

describe("showcase draft edits", () => {
  const edit = {
    field: "brief",
    expectedValue: initialProject.brief,
    value: "Plan a shared herb garden.",
  };
  it("requires explicit editing and rejects stale agent writes", () => {
    expect(applyProjectEdit(initialProject, false, edit).error).toBeTruthy();
    expect(
      applyProjectEdit({ ...initialProject, brief: "A newer manual edit" }, true, edit).error,
    ).toBeTruthy();
  });
  it("validates untrusted arguments and field limits", () => {
    for (const args of [
      null,
      [],
      "text",
      {},
      { ...edit, field: "internalNote" },
      { ...edit, value: 5 },
      { ...edit, value: " " },
      { ...edit, value: "x".repeat(2001) },
    ]) {
      expect(applyProjectEdit(initialProject, true, args).error).toBeTruthy();
    }
    expect(projectErrors({ name: "", brief: "" })).toEqual({
      name: expect.any(String),
      brief: expect.any(String),
    });
  });
  it("returns a new draft without mutating or saving the source", () => {
    const before = { ...initialProject };
    expect(applyProjectEdit(initialProject, true, edit).draft).toEqual({
      ...initialProject,
      brief: edit.value,
    });
    expect(initialProject).toEqual(before);
  });
});

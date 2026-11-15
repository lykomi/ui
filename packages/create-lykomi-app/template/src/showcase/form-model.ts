export interface ProjectDraft {
  name: string;
  brief: string;
}
export const initialProject: ProjectDraft = {
  name: "Neighborhood garden",
  brief: "Help neighbors plan a shared garden, choose what to grow, and coordinate weekly tasks.",
};

/** The same validation serves manual saves and agent edits. */
export function projectErrors(draft: ProjectDraft) {
  return {
    name: !draft.name.trim()
      ? "Give the project a name."
      : draft.name.length > 80
        ? "Use 80 characters or fewer."
        : undefined,
    brief: !draft.brief.trim()
      ? "Describe what this project should do."
      : draft.brief.length > 2000
        ? "Use 2,000 characters or fewer."
        : undefined,
  };
}

export function applyProjectEdit(current: ProjectDraft, editing: boolean, args: unknown) {
  if (!editing) return { error: "Choose Edit project before changing a field." };
  if (!args || typeof args !== "object" || Array.isArray(args))
    return { error: "Expected an object." };
  const { field, expectedValue, value } = args as Record<string, unknown>;
  if ((field !== "name" && field !== "brief") || typeof value !== "string")
    return { error: "Choose name or brief and supply a string value." };
  if (expectedValue !== current[field])
    return { error: "The field changed. Read the current context before retrying." };
  const next = { ...current, [field]: value };
  const error = projectErrors(next)[field];
  return error ? { error } : { draft: next };
}

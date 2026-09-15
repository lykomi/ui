/** Apply changes in the visible UI to retained server state, preserving server
 * updates when the corresponding UI value has not changed since the last turn. */
export function mergeChatState(
  server: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...server };
  for (const key of new Set([...Object.keys(previous ?? {}), ...Object.keys(current)])) {
    const before = previous?.[key];
    const after = current[key];
    if (previous && JSON.stringify(before) === JSON.stringify(after)) continue;
    if (!(key in current)) {
      delete result[key];
      continue;
    }
    const object = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === "object" && !Array.isArray(value);
    result[key] =
      object(before) && object(after) && object(server[key])
        ? mergeChatState(server[key], before, after)
        : after;
  }
  return result;
}

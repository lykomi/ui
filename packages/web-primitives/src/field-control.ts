// Internal identity shared by controls and Field; Field imports no implementations.
const FIELD_CONTROL = Symbol.for("@lykomi/web-primitives/field-control");

export function markFieldControl(control: object): void {
  Object.defineProperty(control, FIELD_CONTROL, { value: true });
}

export function isFieldControl(control: unknown): boolean {
  return (
    control !== null &&
    (typeof control === "object" || typeof control === "function") &&
    (control as Record<symbol, unknown>)[FIELD_CONTROL] === true
  );
}

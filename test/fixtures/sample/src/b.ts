import { aValue } from "./a.js";

export function bValue(): number {
  // Intentional cyclic dependency with a.ts to exercise cycle detection.
  return aValue() > 10 ? 1 : 2;
}

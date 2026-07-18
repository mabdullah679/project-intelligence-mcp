/**
 * Canonical JSON serialization: object keys sorted recursively, 2-space indent,
 * trailing newline. This is what makes derived artifacts byte-stable across runs
 * (same repo state -> identical bytes) and therefore reviewable as clean git diffs.
 *
 * Arrays are NOT reordered — array order is meaningful data and callers are
 * responsible for sorting arrays deterministically before serialization.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + "\n";
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

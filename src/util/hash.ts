import { createHash } from "node:crypto";

/** Full hex SHA-256 of a string or buffer. */
export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Short (12-char) content hash — enough to disambiguate files, compact in diffs. */
export function shortHash(data: string | Uint8Array): string {
  return sha256(data).slice(0, 12);
}

/**
 * Stable aggregate hash over an ordered list of parts. Order matters, so callers
 * must sort first when they want order-independence. Used for scan/graph fingerprints.
 */
export function aggregateHash(parts: string[]): string {
  const h = createHash("sha256");
  for (const p of parts) {
    h.update(p);
    h.update("\0");
  }
  return h.digest("hex").slice(0, 16);
}

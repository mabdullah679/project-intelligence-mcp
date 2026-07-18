import { readdir } from "node:fs/promises";

/**
 * Append-only artifacts (ADRs, invariants, sprints, sessions) are numbered with
 * zero-padded, monotonically increasing indices. This keeps them ordered and
 * diff-friendly in git. The next index is derived from existing files, so the
 * scheme survives files created by hand.
 */
export function pad(n: number, width = 4): string {
  return String(n).padStart(width, "0");
}

export async function nextNumber(dir: string): Promise<number> {
  let max = -1;
  try {
    for (const name of await readdir(dir)) {
      const m = /^(\d+)/.exec(name);
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch {
    /* dir missing -> start at 0 */
  }
  return max + 1;
}

/** Filesystem-safe kebab slug from a title, for use in artifact filenames. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

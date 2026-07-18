import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the multi-language sample fixture repository. */
export const SAMPLE_REPO = join(here, "fixtures", "sample");

/** A temp path under the OS temp dir, unique per test name (no clock used). */
export function tmpRepoPath(name: string): string {
  return join(here, "..", "node_modules", ".tmp-test", name);
}

import { mkdir, writeFile, rename, readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";

/** Ensure a directory (and parents) exists. No-op if already present. */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Atomic write: write to a temp sibling then rename over the target, so a
 * concurrent reader never observes a half-written file and a crash mid-write
 * cannot corrupt an existing artifact.
 */
export async function writeFileAtomic(path: string, contents: string): Promise<void> {
  await ensureDir(dirname(path));
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, contents, "utf8");
  await rename(tmp, path);
}

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

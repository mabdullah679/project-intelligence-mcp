import { z } from "zod";
import { readTextIfExists, writeFileAtomic } from "../util/fsx.js";
import { canonicalJson } from "../util/json.js";
import { SCHEMA_VERSION } from "../domain/version.js";
import type { PiLayout } from "./layout.js";

/**
 * The manifest is the one derived file allowed to carry timestamps and identity
 * metadata. It lets `intel.status` answer "are the derived artifacts current?"
 * by comparing the recorded scan fingerprint and generator versions against a
 * fresh scan — without re-reading every artifact.
 */
export const ManifestSchema = z.object({
  schemaVersion: z.string(),
  dirName: z.string(),
  lastScanHash: z.string().nullable(),
  generators: z.record(z.string(), z.string()),
  /** ISO timestamp of the last derived-artifact write (captured, not embedded in bodies). */
  updatedAt: z.string().nullable(),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export function emptyManifest(dirName: string): Manifest {
  return {
    schemaVersion: SCHEMA_VERSION,
    dirName,
    lastScanHash: null,
    generators: {},
    updatedAt: null,
  };
}

export async function readManifest(layout: PiLayout, dirName: string): Promise<Manifest> {
  const raw = await readTextIfExists(layout.manifestFile);
  if (!raw) return emptyManifest(dirName);
  try {
    return ManifestSchema.parse(JSON.parse(raw));
  } catch {
    return emptyManifest(dirName);
  }
}

export async function writeManifest(layout: PiLayout, manifest: Manifest): Promise<void> {
  await writeFileAtomic(layout.manifestFile, canonicalJson(manifest));
}

/**
 * Read-modify-write the manifest, merging generator tags and updating the scan
 * fingerprint. `now` is passed in (never read from the clock here) so callers
 * control timestamp provenance and tests stay deterministic.
 */
export async function updateManifest(
  layout: PiLayout,
  dirName: string,
  patch: { lastScanHash?: string; generators?: Record<string, string>; now: string },
): Promise<Manifest> {
  const current = await readManifest(layout, dirName);
  const next: Manifest = {
    ...current,
    dirName,
    lastScanHash: patch.lastScanHash ?? current.lastScanHash,
    generators: { ...current.generators, ...(patch.generators ?? {}) },
    updatedAt: patch.now,
  };
  await writeManifest(layout, next);
  return next;
}

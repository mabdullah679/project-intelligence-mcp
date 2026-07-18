import { join } from "node:path";
import type { ArchitectureGraph, RepoScan } from "../../domain/schemas.js";
import { GENERATORS } from "../../domain/version.js";
import { readTextIfExists } from "../../util/fsx.js";

export interface OwnershipRule {
  pattern: string;
  owners: string[];
}

export interface ComponentCatalog {
  services: Array<{ path: string; reason: string }>;
  modules: Array<{ id: string; fileCount: number }>;
  entrypoints: string[];
  tests: string[];
  docs: string[];
  owners: OwnershipRule[];
  generator: string;
}

const SERVICE_DIR_HINTS = /(^|\/)(services?|server|api|cmd|worker|daemon|functions?)(\/|$)/i;

/**
 * Discover the human-facing components of a repository: services, modules, test
 * suites, docs, entrypoints, and ownership. Pure over the scan + architecture,
 * plus a CODEOWNERS file if one exists on disk.
 */
export async function buildComponentCatalog(
  scan: RepoScan,
  arch: ArchitectureGraph,
  repoPath: string,
): Promise<ComponentCatalog> {
  const entrypoints = scan.files.filter((f) => f.isEntrypoint).map((f) => f.path).sort();
  const tests = scan.files.filter((f) => f.isTest).map((f) => f.path).sort();
  const docs = scan.files.filter((f) => f.isDoc).map((f) => f.path).sort();

  const services: ComponentCatalog["services"] = [];
  const seenService = new Set<string>();
  for (const f of scan.files) {
    if (f.isEntrypoint && SERVICE_DIR_HINTS.test(f.path)) {
      const key = f.path;
      if (!seenService.has(key)) {
        seenService.add(key);
        services.push({ path: f.path, reason: "entrypoint under a service directory" });
      }
    }
    if (/(^|\/)dockerfile$/i.test(f.path)) {
      const key = f.path;
      if (!seenService.has(key)) {
        seenService.add(key);
        services.push({ path: f.path, reason: "Dockerfile present" });
      }
    }
  }
  services.sort((a, b) => (a.path < b.path ? -1 : 1));

  const modules = arch.modules.map((m) => ({ id: m.id, fileCount: m.fileCount }));
  const owners = await parseCodeowners(repoPath);

  return {
    services,
    modules,
    entrypoints,
    tests,
    docs,
    owners,
    generator: GENERATORS.componentCatalog,
  };
}

async function parseCodeowners(repoPath: string): Promise<OwnershipRule[]> {
  for (const rel of ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]) {
    const raw = await readTextIfExists(join(repoPath, rel));
    if (!raw) continue;
    const rules: OwnershipRule[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [pattern, ...owners] = trimmed.split(/\s+/);
      if (pattern && owners.length) rules.push({ pattern, owners });
    }
    return rules;
  }
  return [];
}

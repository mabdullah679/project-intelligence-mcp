import type { Config } from "../config/config.js";
import type { ArchitectureGraph, DependencyGraph, RepoScan } from "../domain/schemas.js";
import { scanRepository } from "./scan/scan.js";
import { buildDependencyGraph } from "./graph/dependencies.js";
import { buildArchitecture } from "./graph/architecture.js";

/**
 * Composition of the analysis stages. Tools call these instead of wiring the
 * core modules themselves, which keeps the deterministic pipeline in one place
 * and makes the derived artifacts consistent regardless of entry point.
 */
export interface Analysis {
  scan: RepoScan;
  deps: DependencyGraph;
  arch: ArchitectureGraph;
}

export async function runScan(repoPath: string, config: Config): Promise<RepoScan> {
  return scanRepository(repoPath, config);
}

export async function runAnalysis(repoPath: string, config: Config): Promise<Analysis> {
  const scan = await scanRepository(repoPath, config);
  const deps = await buildDependencyGraph(scan, config);
  const arch = buildArchitecture(scan, deps, config);
  return { scan, deps, arch };
}

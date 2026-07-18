import { relative } from "node:path";
import type { ArchitectureGraph, DependencyGraph, RepoScan } from "../domain/schemas.js";
import type { ComponentCatalog } from "../core/discover/catalog.js";
import { writeFileAtomic } from "../util/fsx.js";
import { canonicalJson } from "../util/json.js";
import type { PiLayout } from "./layout.js";
import {
  renderArchitecture,
  renderComponentCatalog,
  renderDependencyGraph,
  renderLanguageStats,
  renderRepositorySummary,
} from "./render.js";

/**
 * Persistence facade for derived artifacts. Every derived artifact is written as
 * BOTH canonical JSON (the MCP's source of truth) and rendered Markdown (human
 * git review). All writes are atomic and confined to derived/ — this layer never
 * touches authored/ or memory/, which is what guarantees human knowledge is safe
 * across regeneration.
 */

async function writeJsonMd(
  jsonPath: string,
  json: unknown,
  mdPath: string,
  md: string,
): Promise<string[]> {
  await writeFileAtomic(jsonPath, canonicalJson(json));
  await writeFileAtomic(mdPath, md);
  return [jsonPath, mdPath];
}

export async function persistScan(layout: PiLayout, scan: RepoScan): Promise<string[]> {
  const written: string[] = [];
  // Repository summary (JSON summary + rendered MD).
  written.push(
    ...(await writeJsonMd(
      layout.derived.repositorySummaryJson,
      summarize(scan),
      layout.derived.repositorySummaryMd,
      renderRepositorySummary(scan),
    )),
  );
  // Full file index (JSON only — too large and machine-oriented for MD).
  await writeFileAtomic(layout.derived.fileIndexJson, canonicalJson({ files: scan.files, generator: scan.generator }));
  written.push(layout.derived.fileIndexJson);
  // Language stats.
  written.push(
    ...(await writeJsonMd(
      layout.derived.languageStatsJson,
      { languages: scan.languages, generator: scan.generator },
      layout.derived.languageStatsMd,
      renderLanguageStats(scan),
    )),
  );
  return written;
}

export async function persistDependencyGraph(layout: PiLayout, graph: DependencyGraph): Promise<string[]> {
  return writeJsonMd(
    layout.derived.dependencyGraphJson,
    graph,
    layout.derived.dependencyGraphMd,
    renderDependencyGraph(graph),
  );
}

export async function persistArchitecture(layout: PiLayout, arch: ArchitectureGraph): Promise<string[]> {
  return writeJsonMd(
    layout.derived.architectureJson,
    arch,
    layout.derived.architectureMd,
    renderArchitecture(arch),
  );
}

export async function persistComponentCatalog(layout: PiLayout, cat: ComponentCatalog): Promise<string[]> {
  return writeJsonMd(
    layout.derived.componentCatalogJson,
    cat,
    layout.derived.componentCatalogMd,
    renderComponentCatalog(cat),
  );
}

/** Compact repository summary object (distinct from the full file index). */
function summarize(scan: RepoScan) {
  return {
    repoPath: scan.repoPath,
    fileCount: scan.fileCount,
    totalBytes: scan.totalBytes,
    languageCount: Object.keys(scan.languages).length,
    languages: scan.languages,
    testFiles: scan.files.filter((f) => f.isTest).length,
    docFiles: scan.files.filter((f) => f.isDoc).length,
    entrypoints: scan.files.filter((f) => f.isEntrypoint).map((f) => f.path),
    scanHash: scan.scanHash,
    generator: scan.generator,
  };
}

/** Repo-relative rendering of written paths, for compact tool output. */
export function relPaths(repoPath: string, paths: string[]): string[] {
  return paths.map((p) => relative(repoPath, p));
}

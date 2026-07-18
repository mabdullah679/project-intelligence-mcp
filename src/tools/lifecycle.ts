import { z } from "zod";
import { defineTool, ok, RepoInput } from "./types.js";
import { loadConfig } from "../config/config.js";
import { piLayout } from "../store/layout.js";
import { readManifest, updateManifest } from "../store/manifest.js";
import {
  persistArchitecture,
  persistComponentCatalog,
  persistDependencyGraph,
  persistScan,
  relPaths,
} from "../store/store.js";
import { runScan, runAnalysis } from "../core/pipeline.js";
import { buildComponentCatalog } from "../core/discover/catalog.js";
import { isInitialized } from "../core/init/scaffold.js";
import { GENERATORS } from "../domain/version.js";

/**
 * intel.status — report whether derived artifacts are current. Compares a fresh
 * scan fingerprint and the current generator versions against what the manifest
 * recorded, so the host knows if it should regenerate before trusting derived data.
 */
export const intelStatus = defineTool({
  name: "intel_status",
  title: "Project intelligence status",
  description:
    "Report freshness of derived artifacts: compares a fresh repository scan fingerprint and current generator versions against the recorded manifest. Lists stale artifacts (repo changed since last generation, or produced by an older generator).",
  input: RepoInput,
  async run({ repoPath }) {
    const config = await loadConfig(repoPath);
    const layout = piLayout(repoPath, config.dirName);

    if (!(await isInitialized(layout))) {
      return ok({ initialized: false, fresh: false, staleArtifacts: [] }, [
        "Project intelligence is not initialized; run intel_init first.",
      ]);
    }

    const scan = await runScan(repoPath, config);
    const manifest = await readManifest(layout, config.dirName);

    const repoChanged = manifest.lastScanHash !== scan.scanHash;
    const stale: string[] = [];
    // Artifacts derived from the repo become stale when the repo changes.
    if (repoChanged) stale.push("repository-summary", "file-index", "dependency-graph", "architecture", "component-catalog");
    // Generator-version drift makes an artifact stale even if the repo is unchanged.
    for (const [key, version] of Object.entries(GENERATORS)) {
      if (manifest.generators[key] && manifest.generators[key] !== version) stale.push(`${key}(generator)`);
    }

    return ok({
      initialized: true,
      fresh: stale.length === 0,
      currentScanHash: scan.scanHash,
      recordedScanHash: manifest.lastScanHash,
      staleArtifacts: [...new Set(stale)],
      generators: { current: GENERATORS, recorded: manifest.generators },
    });
  },
});

const ARTIFACTS = ["scan", "dependencies", "architecture", "catalog"] as const;

/**
 * intel.regenerate — rebuild derived artifacts from the current repository state.
 * Only ever writes inside derived/; authored/ and memory/ are never touched.
 */
export const intelRegenerate = defineTool({
  name: "intel_regenerate",
  title: "Regenerate derived artifacts",
  description:
    "Rebuild derived artifacts (repository summary, file index, language stats, dependency graph, architecture, component catalog) from the current repository state. Writes only inside derived/ — authored knowledge and memory are never modified. `only` restricts which artifacts to rebuild.",
  input: RepoInput.extend({
    only: z
      .array(z.enum(ARTIFACTS))
      .optional()
      .describe("Restrict regeneration to these artifacts; default rebuilds all."),
  }),
  async run({ repoPath, only }) {
    const config = await loadConfig(repoPath);
    const layout = piLayout(repoPath, config.dirName);
    const want = new Set(only && only.length ? only : ARTIFACTS);

    const { scan, deps, arch } = await runAnalysis(repoPath, config);
    const written: string[] = [];
    const generators: Record<string, string> = {};

    if (want.has("scan")) {
      written.push(...(await persistScan(layout, scan)));
      generators.scan = scan.generator;
    }
    if (want.has("dependencies")) {
      written.push(...(await persistDependencyGraph(layout, deps)));
      generators.dependencyGraph = deps.generator;
    }
    if (want.has("architecture")) {
      written.push(...(await persistArchitecture(layout, arch)));
      generators.architecture = arch.generator;
    }
    if (want.has("catalog")) {
      const catalog = await buildComponentCatalog(scan, arch, repoPath);
      written.push(...(await persistComponentCatalog(layout, catalog)));
      generators.componentCatalog = catalog.generator;
    }

    await updateManifest(layout, config.dirName, {
      lastScanHash: scan.scanHash,
      generators,
      now: new Date().toISOString(),
    });

    return ok({ written: relPaths(repoPath, written) });
  },
});

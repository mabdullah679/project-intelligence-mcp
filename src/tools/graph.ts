import { z } from "zod";
import { defineTool, ok, RepoInput } from "./types.js";
import { loadConfig } from "../config/config.js";
import { piLayout } from "../store/layout.js";
import { persistArchitecture, persistDependencyGraph, relPaths } from "../store/store.js";
import { updateManifest } from "../store/manifest.js";
import { runScan } from "../core/pipeline.js";
import { buildDependencyGraph } from "../core/graph/dependencies.js";
import { buildArchitecture } from "../core/graph/architecture.js";

/**
 * graph.dependencies — resolve imports into a file-level dependency graph with
 * external dependencies and import cycles.
 */
export const graphDependencies = defineTool({
  name: "graph_dependencies",
  title: "Build dependency graph",
  description:
    "Build the file-level dependency graph: resolve internal imports to files, collect declared external dependencies from manifests (package.json, go.mod, pyproject, Cargo.toml, requirements.txt, Gemfile), and detect import cycles. Persists dependency-graph into derived/.",
  input: RepoInput.extend({
    persist: z.boolean().default(true),
  }),
  async run({ repoPath, persist }) {
    const config = await loadConfig(repoPath);
    const scan = await runScan(repoPath, config);
    const deps = await buildDependencyGraph(scan, config);

    let written: string[] = [];
    if (persist) {
      const layout = piLayout(repoPath, config.dirName);
      written = await persistDependencyGraph(layout, deps);
      await updateManifest(layout, config.dirName, {
        generators: { dependencyGraph: deps.generator },
        now: new Date().toISOString(),
      });
    }

    return ok({
      nodeCount: deps.nodes.length,
      edgeCount: deps.edges.length,
      externalDepCount: deps.externalDeps.length,
      cycleCount: deps.cycles.length,
      cycles: deps.cycles,
      unresolvedImports: deps.unresolvedImports,
      externalDeps: deps.externalDeps,
      written: relPaths(repoPath, written),
    });
  },
});

/**
 * graph.architecture — cluster files into modules and produce a module-level
 * architecture view with edges, cycles, coupling metrics, and layers.
 */
export const graphArchitecture = defineTool({
  name: "graph_architecture",
  title: "Build architecture graph",
  description:
    "Cluster files into modules (top-level dirs, or one level under configured boundary hints), collapse dependencies into weighted module edges, detect module cycles, compute fan-in/fan-out/instability, and assign architectural layers. Persists architecture into derived/.",
  input: RepoInput.extend({
    boundaryHints: z
      .array(z.string())
      .optional()
      .describe("Directory prefixes that force module boundaries, e.g. ['packages','services']."),
    persist: z.boolean().default(true),
  }),
  async run({ repoPath, boundaryHints, persist }) {
    const config = await loadConfig(repoPath);
    if (boundaryHints) config.analysis.boundaryHints = boundaryHints;

    const scan = await runScan(repoPath, config);
    const deps = await buildDependencyGraph(scan, config);
    const arch = buildArchitecture(scan, deps, config);

    let written: string[] = [];
    if (persist) {
      const layout = piLayout(repoPath, config.dirName);
      written = await persistArchitecture(layout, arch);
      await updateManifest(layout, config.dirName, {
        generators: { architecture: arch.generator },
        now: new Date().toISOString(),
      });
    }

    return ok({
      moduleCount: arch.modules.length,
      moduleEdgeCount: arch.edges.length,
      cycleCount: arch.cycles.length,
      layerCount: arch.layers.length,
      modules: arch.modules,
      layers: arch.layers,
      cycles: arch.cycles,
      metrics: arch.metrics,
      written: relPaths(repoPath, written),
    });
  },
});

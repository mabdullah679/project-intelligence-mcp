import { describe, it, expect } from "vitest";
import { scanRepository } from "../src/core/scan/scan.js";
import { buildDependencyGraph } from "../src/core/graph/dependencies.js";
import { buildArchitecture } from "../src/core/graph/architecture.js";
import { defaultConfig } from "../src/config/config.js";
import { SAMPLE_REPO } from "./helpers.js";

describe("dependency graph", () => {
  it("resolves internal imports, collects external deps, and detects cycles", async () => {
    const scan = await scanRepository(SAMPLE_REPO, defaultConfig());
    const graph = await buildDependencyGraph(scan, defaultConfig());

    const edgeSet = new Set(graph.edges.map((e) => `${e.from}->${e.to}`));
    // index.ts imports service.ts and util.ts (resolved despite .js specifier).
    expect(edgeSet.has("src/index.ts->src/service.ts")).toBe(true);
    expect(edgeSet.has("src/service.ts->src/util.ts")).toBe(true);

    // External deps from package.json.
    const extNames = graph.externalDeps.map((d) => d.name);
    expect(extNames).toEqual(expect.arrayContaining(["left-pad", "lodash", "vitest"]));

    // a.ts <-> b.ts form a cycle.
    expect(graph.cycles.some((c) => c.includes("src/a.ts") && c.includes("src/b.ts"))).toBe(true);

    expect(graph.unresolvedImports).toBe(0);
  });
});

describe("architecture graph", () => {
  it("clusters files into top-level modules with metrics and layers", async () => {
    const scan = await scanRepository(SAMPLE_REPO, defaultConfig());
    const deps = await buildDependencyGraph(scan, defaultConfig());
    const arch = buildArchitecture(scan, deps, defaultConfig());

    const moduleIds = arch.modules.map((m) => m.id);
    expect(moduleIds).toEqual(expect.arrayContaining(["src", "app", "pkg", "weird"]));

    // Every module has metrics.
    for (const id of moduleIds) expect(arch.metrics[id]).toBeDefined();

    // Layers cover all modules exactly once.
    const inLayers = arch.layers.flat().sort();
    expect(inLayers).toEqual([...moduleIds].sort());
  });
});

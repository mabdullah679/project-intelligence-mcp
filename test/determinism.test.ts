import { describe, it, expect } from "vitest";
import { scanRepository } from "../src/core/scan/scan.js";
import { buildDependencyGraph } from "../src/core/graph/dependencies.js";
import { buildArchitecture } from "../src/core/graph/architecture.js";
import { defaultConfig } from "../src/config/config.js";
import { canonicalJson } from "../src/util/json.js";
import { SAMPLE_REPO } from "./helpers.js";

describe("determinism", () => {
  it("produces byte-identical canonical output across runs", async () => {
    const runOnce = async () => {
      const scan = await scanRepository(SAMPLE_REPO, defaultConfig());
      const deps = await buildDependencyGraph(scan, defaultConfig());
      const arch = buildArchitecture(scan, deps, defaultConfig());
      return {
        scan: canonicalJson(scan),
        deps: canonicalJson(deps),
        arch: canonicalJson(arch),
      };
    };

    const a = await runOnce();
    const b = await runOnce();
    expect(a.scan).toEqual(b.scan);
    expect(a.deps).toEqual(b.deps);
    expect(a.arch).toEqual(b.arch);
  });
});

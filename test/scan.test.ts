import { describe, it, expect } from "vitest";
import { scanRepository } from "../src/core/scan/scan.js";
import { defaultConfig } from "../src/config/config.js";
import { SAMPLE_REPO } from "./helpers.js";

describe("scanRepository", () => {
  it("discovers files, languages, symbols, and flags across languages", async () => {
    const scan = await scanRepository(SAMPLE_REPO, defaultConfig());

    // Languages detected.
    expect(Object.keys(scan.languages)).toEqual(
      expect.arrayContaining(["typescript", "python", "go", "json"]),
    );

    const byPath = new Map(scan.files.map((f) => [f.path, f]));

    // TypeScript symbols via tree-sitter (high confidence).
    const util = byPath.get("src/util.ts");
    expect(util?.confidence).toBe("high");
    expect(util?.symbols.map((s) => s.name)).toEqual(
      expect.arrayContaining(["formatMessage", "GREETING"]),
    );

    // Python class + function.
    const helper = byPath.get("app/helper.py");
    expect(helper?.confidence).toBe("high");
    expect(helper?.symbols.map((s) => s.name)).toEqual(
      expect.arrayContaining(["build_path", "Formatter"]),
    );

    // Go type + functions (exported = uppercase).
    const server = byPath.get("pkg/server.go");
    expect(server?.symbols.map((s) => s.name)).toEqual(
      expect.arrayContaining(["Server", "NewServer", "Start"]),
    );

    // Test-file detection.
    expect(byPath.get("src/service.test.ts")?.isTest).toBe(true);
    // Entrypoint detection.
    expect(byPath.get("src/index.ts")?.isEntrypoint).toBe(true);
  });

  it("falls back to heuristics for languages without a grammar", async () => {
    const scan = await scanRepository(SAMPLE_REPO, defaultConfig());
    const zeta = scan.files.find((f) => f.path === "weird/thing.zeta");
    expect(zeta).toBeDefined();
    expect(zeta?.confidence).toBe("low");
    // Heuristic import + symbol extraction still finds something useful.
    expect(zeta!.imports.length).toBeGreaterThan(0);
    expect(zeta!.symbols.map((s) => s.name)).toEqual(expect.arrayContaining(["computeThing"]));
  });
});

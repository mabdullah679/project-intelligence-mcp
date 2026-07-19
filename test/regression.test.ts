import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { rm, mkdir, cp, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanRepository } from "../src/core/scan/scan.js";
import { buildDependencyGraph } from "../src/core/graph/dependencies.js";
import { defaultConfig } from "../src/config/config.js";
import { captureDiff } from "../src/core/evidence/diff.js";
import { tmpRepoPath } from "./helpers.js";

const here = dirname(fileURLToPath(import.meta.url));
const PYREL = join(here, "fixtures", "pyrel");

// Regression for audit finding #2: Python explicit-relative imports must resolve
// with package semantics, and dangling ones must be reported unresolved — not
// fabricated as edges to an index/main file.
describe("python relative imports (#2)", () => {
  it("resolves `.helper`, does not fabricate edges, and counts dangling imports", async () => {
    const scan = await scanRepository(PYREL, defaultConfig());
    const graph = await buildDependencyGraph(scan, defaultConfig());
    const edges = new Set(graph.edges.map((e) => `${e.from}->${e.to}`));

    expect(edges.has("pkg/main.py->pkg/helper.py")).toBe(true);
    // The dangling `.missing` import must NOT resolve to anything (no fabricated edge).
    expect([...edges].some((e) => e.startsWith("pkg/main.py->") && !e.endsWith("pkg/helper.py"))).toBe(false);
    // ...and it must be counted as unresolved.
    expect(graph.unresolvedImports).toBeGreaterThanOrEqual(1);
  });
});

// Regression for audit finding #1: evidence_diff must not allow shell injection
// via model-supplied `base` / `paths`.
describe("evidence_diff command injection is closed (#1)", () => {
  it("treats malicious base/paths as literal git args, never executing them", async () => {
    const repo = tmpRepoPath("evidence-injection");
    await rm(repo, { recursive: true, force: true });
    await mkdir(repo, { recursive: true });
    await cp(join(here, "fixtures", "sample"), repo, { recursive: true });
    execFileSync("git", ["init", "-q"], { cwd: repo });
    execFileSync("git", ["config", "user.email", "t@t.t"], { cwd: repo });
    execFileSync("git", ["config", "user.name", "t"], { cwd: repo });
    execFileSync("git", ["add", "-A"], { cwd: repo });
    execFileSync("git", ["commit", "-qm", "init"], { cwd: repo });

    const marker = join(repo, "PWNED");
    const res = await captureDiff(repo, `HEAD; touch ${marker}`, [`'; touch ${marker}; echo '`]);

    // The injected `touch` must never have run.
    await expect(stat(marker)).rejects.toBeTruthy();
    // The malformed base is rejected with a warning and falls back to HEAD.
    expect(res.base).toBe("HEAD");
    expect(res.warnings.some((w) => w.includes("invalid base"))).toBe(true);

    await rm(repo, { recursive: true, force: true });
  });
});

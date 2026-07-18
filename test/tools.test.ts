import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { cp, rm, readdir, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { SAMPLE_REPO, tmpRepoPath } from "./helpers.js";
import { intelInit } from "../src/tools/intel.js";
import { intelStatus, intelRegenerate } from "../src/tools/lifecycle.js";
import { decisionRecord, invariantRecord } from "../src/tools/knowledge.js";
import { validateRun } from "../src/tools/evidence.js";
import { sprintCheckpointTool } from "../src/tools/sprint.js";
import { pathExists, writeFileAtomic } from "../src/util/fsx.js";

const REPO = tmpRepoPath("tools");

beforeAll(async () => {
  await rm(REPO, { recursive: true, force: true });
  await mkdir(REPO, { recursive: true });
  await cp(SAMPLE_REPO, REPO, { recursive: true });
});
afterAll(async () => {
  await rm(REPO, { recursive: true, force: true });
});

describe("lifecycle tools", () => {
  it("init -> stale -> regenerate -> fresh", async () => {
    const init = await intelInit.run({ repoPath: REPO, dirName: ".pi" });
    expect(init.ok).toBe(true);
    expect(await pathExists(join(REPO, ".pi", "config.json"))).toBe(true);

    const before = await intelStatus.run({ repoPath: REPO });
    expect(before.fresh).toBe(false);

    const regen = await intelRegenerate.run({ repoPath: REPO, only: undefined });
    expect((regen.written as string[]).length).toBeGreaterThan(0);
    expect(await pathExists(join(REPO, ".pi", "derived", "architecture.json"))).toBe(true);

    const after = await intelStatus.run({ repoPath: REPO });
    expect(after.fresh).toBe(true);
  });
});

describe("knowledge tools", () => {
  it("records an ADR and an invariant without touching existing authored files", async () => {
    const adr = await decisionRecord.run({
      repoPath: REPO,
      title: "Adopt X",
      context: "c",
      decision: "d",
      consequences: "e",
      status: undefined,
    });
    expect(adr.number).toBe(1); // 0000 is the seeded guide
    expect(await pathExists(join(REPO, ".pi", "authored", "decisions", "0001-adopt-x.md"))).toBe(true);

    const inv = await invariantRecord.run({
      repoPath: REPO,
      statement: "IDs are UUIDv4",
      rationale: "uniqueness",
      scope: "global",
    });
    expect(inv.ok).toBe(true);
    const index = JSON.parse(await readFile(join(REPO, ".pi", "derived", "invariants-index.json"), "utf8"));
    expect(index.invariants.map((i: { statement: string }) => i.statement)).toContain("IDs are UUIDv4");
  });
});

describe("validate.run", () => {
  it("runs configured checks and reports pass/fail", async () => {
    // Inject validation commands into the repo config.
    const cfgPath = join(REPO, ".pi", "config.json");
    const cfg = JSON.parse(await readFile(cfgPath, "utf8"));
    cfg.validation.test = "exit 0";
    cfg.validation.lint = "exit 1";
    await writeFileAtomic(cfgPath, JSON.stringify(cfg));

    const res = await validateRun.run({ repoPath: REPO, checks: undefined, persistEvidence: true });
    const results = res.results as Array<{ name: string; passed: boolean }>;
    expect(results.find((r) => r.name === "test")?.passed).toBe(true);
    expect(results.find((r) => r.name === "lint")?.passed).toBe(false);
    expect(res.allPassed).toBe(false);
  });
});

describe("sprint.checkpoint", () => {
  it("computes an initial checkpoint then a delta on the next", async () => {
    const first = await sprintCheckpointTool.run({
      repoPath: REPO,
      narrative: { summary: "baseline" },
    });
    expect((first.computedDelta as { isInitial: boolean }).isInitial).toBe(true);

    // Add a new top-level module, then checkpoint again.
    await mkdir(join(REPO, "extra"), { recursive: true });
    await writeFileAtomic(join(REPO, "extra", "thing.ts"), "export const thing = 1;\n");

    const second = await sprintCheckpointTool.run({
      repoPath: REPO,
      narrative: { summary: "add extra module" },
    });
    const delta = second.computedDelta as { isInitial: boolean; addedModules: string[]; addedFiles: number };
    expect(delta.isInitial).toBe(false);
    expect(delta.addedModules).toContain("extra");
    expect(delta.addedFiles).toBeGreaterThanOrEqual(1);

    // authored/ ADR from the earlier test is still present (append-only guarantee).
    expect(await pathExists(join(REPO, ".pi", "authored", "decisions", "0001-adopt-x.md"))).toBe(true);
  });
});

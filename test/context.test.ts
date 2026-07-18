import { describe, it, expect } from "vitest";
import { runAnalysis } from "../src/core/pipeline.js";
import { compileContext } from "../src/core/context/compile.js";
import { defaultConfig } from "../src/config/config.js";
import { SAMPLE_REPO } from "./helpers.js";

async function compile(task: string, budgetTokens: number) {
  const { scan, deps, arch } = await runAnalysis(SAMPLE_REPO, defaultConfig());
  return compileContext({
    repoPath: SAMPLE_REPO,
    task,
    budgetTokens,
    charsPerToken: 3.8,
    maxHops: 2,
    maxItems: 60,
    scan,
    deps,
    arch,
    knowledge: [],
  });
}

describe("context compilation", () => {
  it("selects task-relevant files with a manifest", async () => {
    const ctx = await compile("update the UserService greet formatting", 8000);
    const paths = ctx.items.map((i) => i.path);
    expect(paths).toContain("src/service.ts");
    expect(ctx.manifest.itemCount).toBe(ctx.items.length);
    expect(ctx.manifest.coverage).toBeGreaterThan(0);
    // Manifest explains its seeds.
    expect(ctx.manifest.seeds).toContain("src/service.ts");
  });

  it("never exceeds the token budget and reports exclusions", async () => {
    const ctx = await compile("format the user greeting message", 200);
    expect(ctx.manifest.includedTokens).toBeLessThanOrEqual(200);
    // With a tiny budget, at least one candidate is excluded for budget reasons.
    expect(ctx.excluded.some((e) => e.reason.includes("budget"))).toBe(true);
  });

  it("returns an empty context with a warning when nothing matches", async () => {
    const ctx = await compile("quantum blockchain neural crypto", 8000);
    expect(ctx.items.length).toBe(0);
    expect(ctx.warnings.length).toBeGreaterThan(0);
  });
});

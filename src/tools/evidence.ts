import { z } from "zod";
import { defineTool, ok, RepoInput } from "./types.js";
import { loadConfig } from "../config/config.js";
import { piLayout } from "../store/layout.js";
import { relPaths } from "../store/store.js";
import { runValidation } from "../core/evidence/validate.js";
import { captureDiff } from "../core/evidence/diff.js";
import { appendSession } from "../core/memory/session.js";

/**
 * validate.run — run the repository's configured validation commands and capture
 * their results as durable evidence in memory/sessions/.
 */
export const validateRun = defineTool({
  name: "validate_run",
  title: "Run validation & capture evidence",
  description:
    "Run the repository's configured validation commands (test/lint/build/custom from .pi/config.json) and capture pass/fail, exit codes, durations, and output tails as evidence. Persists an evidence record into memory/sessions/. Commands come only from config — the server never invents them.",
  input: RepoInput.extend({
    checks: z
      .array(z.string())
      .optional()
      .describe("Subset of check names to run (e.g. ['test','lint']); default runs all configured."),
    persistEvidence: z.boolean().default(true),
  }),
  async run({ repoPath, checks, persistEvidence }) {
    const config = await loadConfig(repoPath);
    const { results, unknown } = await runValidation(repoPath, config, checks);

    const warnings: string[] = [];
    if (unknown.length) warnings.push(`Unknown/undefined checks ignored: ${unknown.join(", ")}`);
    if (results.length === 0)
      warnings.push("No validation commands are configured in .pi/config.json (validation.test/lint/build/custom).");

    let evidencePath: string | null = null;
    if (persistEvidence && results.length > 0) {
      const layout = piLayout(repoPath, config.dirName);
      const body = results
        .map(
          (r) =>
            `## ${r.name} — ${r.passed ? "PASS" : "FAIL"} (exit ${r.exitCode}, ${r.durationMs}ms)\n\n\`${r.command}\`\n\n\`\`\`\n${r.stdoutTail || r.stderrTail}\n\`\`\``,
        )
        .join("\n\n");
      evidencePath = await appendSession(layout, {
        kind: "validation",
        title: `Validation: ${results.map((r) => `${r.name}=${r.passed ? "pass" : "fail"}`).join(" ")}`,
        body,
        now: new Date().toISOString(),
      });
    }

    return ok(
      {
        allPassed: results.length > 0 && results.every((r) => r.passed),
        results,
        evidencePath: evidencePath ? relPaths(repoPath, [evidencePath])[0] : null,
      },
      warnings,
    );
  },
});

/**
 * evidence.diff — capture a git diff (working tree or against a base) as evidence.
 */
export const evidenceDiff = defineTool({
  name: "evidence_diff",
  title: "Capture diff evidence",
  description:
    "Capture a git diff as reviewable evidence: raw diff plus file/insertion/deletion stats. Defaults to the working-tree diff vs HEAD; a base ref and path filters are optional. Returns isGitRepo=false (not an error) if the target is not a git repository.",
  input: RepoInput.extend({
    base: z.string().optional().describe("Base ref to diff against (default HEAD / working tree)."),
    paths: z.array(z.string()).optional().describe("Restrict the diff to these paths."),
  }),
  async run({ repoPath, base, paths }) {
    const evidence = await captureDiff(repoPath, base, paths);
    const warnings = evidence.isGitRepo ? [] : ["Target is not a git repository; no diff available."];
    return ok(
      {
        isGitRepo: evidence.isGitRepo,
        base: evidence.base,
        stats: evidence.stats,
        diff: evidence.diff,
      },
      warnings,
    );
  },
});

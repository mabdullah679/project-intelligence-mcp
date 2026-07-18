import { z } from "zod";
import { defineTool, ok, RepoInput } from "./types.js";
import { loadConfig } from "../config/config.js";
import { piLayout } from "../store/layout.js";
import { readAuthoredKnowledge } from "../store/authored.js";
import { runAnalysis } from "../core/pipeline.js";
import { compileContext } from "../core/context/compile.js";

/**
 * context.compile — assemble the smallest complete, task-scoped context bounded
 * to the host model's token budget, with a manifest explaining what was included
 * and why. This is the core value tool: deterministic, no LLM involved.
 */
export const contextCompile = defineTool({
  name: "context_compile",
  title: "Compile task context",
  description:
    "Given a task, assemble a bounded, task-scoped context: relevant code (seeded by lexical symbol/path matches and expanded across the dependency graph) plus relevant authored knowledge (ADRs, invariants, policies, roadmap, glossary). Returns a manifest (seeds, coverage, included tokens) and the selected items with per-item score breakdowns; oversized files degrade to signatures to fit the budget. Fully deterministic — the host model does the reasoning.",
  input: RepoInput.extend({
    task: z.string().min(1).describe("Natural-language description of the task."),
    hints: z
      .object({
        paths: z.array(z.string()).optional().describe("Known-relevant file paths to force-seed."),
        symbols: z.array(z.string()).optional().describe("Known-relevant symbol names."),
      })
      .optional(),
    budget: z
      .object({
        tokens: z.number().int().positive().optional().describe("Token budget (default from config.host.tokenBudget)."),
        tokenizerRatio: z
          .number()
          .positive()
          .optional()
          .describe("Chars-per-token ratio for the host model (default from config)."),
      })
      .optional(),
  }),
  async run({ repoPath, task, hints, budget }) {
    const config = await loadConfig(repoPath);
    const { scan, deps, arch } = await runAnalysis(repoPath, config);
    const layout = piLayout(repoPath, config.dirName);
    const knowledge = await readAuthoredKnowledge(layout, repoPath);

    const compiled = await compileContext({
      repoPath,
      task,
      hints,
      budgetTokens: budget?.tokens ?? config.host.tokenBudget,
      charsPerToken: budget?.tokenizerRatio ?? config.host.charsPerToken,
      maxHops: config.context.maxHops,
      maxItems: config.context.maxItems,
      scan,
      deps,
      arch,
      knowledge,
    });

    return ok(
      {
        manifest: compiled.manifest,
        items: compiled.items,
        excluded: compiled.excluded,
      },
      compiled.warnings,
    );
  },
});

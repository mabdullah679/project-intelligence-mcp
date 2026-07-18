import { z } from "zod";
import { defineTool, ok, RepoInput } from "./types.js";
import { loadConfig } from "../config/config.js";
import { piLayout } from "../store/layout.js";
import { relPaths } from "../store/store.js";
import { isInitialized } from "../core/init/scaffold.js";
import { sprintCheckpoint } from "../core/memory/sprint.js";

/**
 * sprint.checkpoint — the milestone-memory tool. The host decides a milestone is
 * complete and supplies the narrative; the MCP computes the deterministic delta
 * from graph snapshots, records provided decisions as ADRs, regenerates derived
 * artifacts, and writes a durable sprint record — all in reviewable git diffs.
 */
export const sprintCheckpointTool = defineTool({
  name: "sprint_checkpoint",
  title: "Sprint / milestone checkpoint",
  description:
    "Record a sprint/milestone checkpoint. The MCP deterministically computes what changed since the last checkpoint (modules, files, tests, dependencies, external deps, languages, invariants, edge count) by diffing graph snapshots, then persists a sprint record combining that delta with the host-provided narrative. Also records provided decisions as ADRs and regenerates derived artifacts. authored/ is only appended to, never overwritten.",
  input: RepoInput.extend({
    narrative: z.object({
      summary: z.string().min(1).describe("One-line summary of the sprint/milestone."),
      decisions: z
        .array(
          z.object({
            title: z.string(),
            context: z.string(),
            decision: z.string(),
            consequences: z.string(),
          }),
        )
        .optional()
        .describe("Decisions to record as ADRs."),
      debt: z.array(z.string()).optional().describe("Technical debt items introduced or discovered."),
      roadmapDelta: z.string().optional().describe("What moved on the roadmap (completed/added/removed)."),
      risks: z.array(z.string()).optional(),
    }),
  }),
  async run({ repoPath, narrative }) {
    const config = await loadConfig(repoPath);
    const layout = piLayout(repoPath, config.dirName);
    if (!(await isInitialized(layout))) {
      throw new Error("Project intelligence is not initialized; run intel_init first.");
    }

    const result = await sprintCheckpoint(repoPath, config, layout, narrative, new Date().toISOString());

    return ok({
      sprintPath: relPaths(repoPath, [result.sprintPath])[0],
      snapshotPath: relPaths(repoPath, [result.snapshotPath])[0],
      adrsRecorded: result.adrs,
      computedDelta: result.delta,
      regenerated: relPaths(repoPath, result.regenerated),
    });
  },
});

import { z } from "zod";
import { defineTool, ok, RepoInput } from "./types.js";
import { scaffold } from "../core/init/scaffold.js";
import { relPaths } from "../store/store.js";

/**
 * intel.init — scaffold the project-intelligence directory in a repository.
 * Idempotent and safe to re-run: it only creates missing files.
 */
export const intelInit = defineTool({
  name: "intel_init",
  title: "Initialize project intelligence",
  description:
    "Scaffold the project-intelligence directory (default `.pi/`) in a repository: authored/, derived/, memory/ plus seed templates (ADR guide, glossary, ownership seeded from CODEOWNERS, default config). Idempotent — existing files are left untouched.",
  input: RepoInput.extend({
    dirName: z
      .string()
      .default(".pi")
      .describe("Directory name for the intelligence dir (default `.pi`)."),
  }),
  async run({ repoPath, dirName }) {
    const result = await scaffold(repoPath, dirName);
    return ok({
      dirName,
      created: relPaths(repoPath, result.created),
      skipped: relPaths(repoPath, result.skipped),
      alreadyInitialized: result.created.length === 0,
    });
  },
});

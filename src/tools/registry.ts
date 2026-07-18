import type { AnyTool } from "./types.js";
import { intelInit } from "./intel.js";
import { intelStatus, intelRegenerate } from "./lifecycle.js";
import { repoScan } from "./repo.js";
import { graphDependencies, graphArchitecture } from "./graph.js";
import { discoverComponents } from "./discover.js";
import { contextCompile } from "./context.js";
import { validateRun, evidenceDiff } from "./evidence.js";
import { decisionRecord, invariantRecord, memorySessionAppend } from "./knowledge.js";
import { sprintCheckpointTool } from "./sprint.js";

/**
 * The tool registry: the single list of tools exposed by both the MCP server and
 * the CLI. Adding a tool here makes it available over every transport at once.
 * Order groups tools by lifecycle: init/status, discovery, context, evidence,
 * knowledge, memory.
 */
export const TOOLS: AnyTool[] = [
  // Lifecycle / meta
  intelInit,
  intelStatus,
  intelRegenerate,
  // Discovery / mapping
  repoScan,
  graphDependencies,
  graphArchitecture,
  discoverComponents,
  // Context
  contextCompile,
  // Validation / evidence
  validateRun,
  evidenceDiff,
  // Knowledge / memory
  decisionRecord,
  invariantRecord,
  memorySessionAppend,
  sprintCheckpointTool,
] as unknown as AnyTool[];

export function toolByName(name: string): AnyTool | undefined {
  // Accept both dot and underscore spellings (context.compile / context_compile).
  const norm = name.replace(/\./g, "_");
  return TOOLS.find((t) => t.name === norm);
}

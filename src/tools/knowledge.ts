import { z } from "zod";
import { defineTool, ok, RepoInput } from "./types.js";
import { loadConfig } from "../config/config.js";
import { piLayout } from "../store/layout.js";
import { relPaths } from "../store/store.js";
import { isInitialized } from "../core/init/scaffold.js";
import { recordDecision } from "../core/memory/decisions.js";
import { recordInvariant } from "../core/memory/invariants.js";
import { appendSession } from "../core/memory/session.js";

async function requireInit(repoPath: string, dirName: string): Promise<void> {
  const layout = piLayout(repoPath, dirName);
  if (!(await isInitialized(layout))) {
    throw new Error("Project intelligence is not initialized; run intel_init first.");
  }
}

/**
 * decision.record — append an ADR to authored/decisions/ (durable, append-only).
 */
export const decisionRecord = defineTool({
  name: "decision_record",
  title: "Record a decision (ADR)",
  description:
    "Append a numbered Architecture Decision Record to authored/decisions/. Durable and append-only — captures a significant decision so it is never re-derived. The host supplies the judgement (context/decision/consequences); the MCP handles numbering and persistence.",
  input: RepoInput.extend({
    title: z.string().min(1),
    context: z.string().min(1).describe("Why this decision was needed."),
    decision: z.string().min(1).describe("What was decided."),
    consequences: z.string().min(1).describe("Resulting trade-offs and implications."),
    status: z.string().optional().describe("ADR status (default 'Accepted')."),
  }),
  async run({ repoPath, title, context, decision, consequences, status }) {
    const config = await loadConfig(repoPath);
    await requireInit(repoPath, config.dirName);
    const layout = piLayout(repoPath, config.dirName);
    const result = await recordDecision(layout, {
      title,
      context,
      decision,
      consequences,
      status,
      now: new Date().toISOString(),
    });
    return ok({ adrPath: relPaths(repoPath, [result.path])[0], number: result.number });
  },
});

/**
 * invariant.record — persist a durable invariant and refresh its derived index.
 */
export const invariantRecord = defineTool({
  name: "invariant_record",
  title: "Record an invariant",
  description:
    "Record a durable, must-not-break invariant in authored/invariants/ and refresh the derived invariants index. Invariants are constraints lost forever if not persisted (e.g. 'all amounts are integer cents').",
  input: RepoInput.extend({
    statement: z.string().min(1).describe("The invariant, stated concisely."),
    rationale: z.string().min(1).describe("Why it must hold."),
    scope: z.string().min(1).describe("Where it applies (module/service/global)."),
  }),
  async run({ repoPath, statement, rationale, scope }) {
    const config = await loadConfig(repoPath);
    await requireInit(repoPath, config.dirName);
    const layout = piLayout(repoPath, config.dirName);
    const result = await recordInvariant(layout, { statement, rationale, scope, now: new Date().toISOString() });
    return ok({ path: relPaths(repoPath, [result.path])[0] });
  },
});

/**
 * memory.session.append — append a lightweight session note to memory/sessions/.
 */
export const memorySessionAppend = defineTool({
  name: "memory_session_append",
  title: "Append a session note",
  description:
    "Append a freeform note to memory/sessions/ (append-only history). Use to record what happened in a working session, with optional references to evidence files.",
  input: RepoInput.extend({
    title: z.string().min(1),
    note: z.string().min(1),
    evidenceRefs: z.array(z.string()).optional(),
  }),
  async run({ repoPath, title, note, evidenceRefs }) {
    const config = await loadConfig(repoPath);
    await requireInit(repoPath, config.dirName);
    const layout = piLayout(repoPath, config.dirName);
    const path = await appendSession(layout, {
      kind: "note",
      title,
      body: note,
      evidenceRefs,
      now: new Date().toISOString(),
    });
    return ok({ path: relPaths(repoPath, [path])[0] });
  },
});

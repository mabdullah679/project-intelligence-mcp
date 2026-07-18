import { join } from "node:path";
import { writeFileAtomic } from "../../util/fsx.js";
import type { PiLayout } from "../../store/layout.js";
import { nextNumber, pad, slugify } from "./numbering.js";

export interface DecisionInput {
  title: string;
  context: string;
  decision: string;
  consequences: string;
  status?: string;
  /** ISO date captured by the caller (kept out of deterministic bodies). */
  now: string;
}

/**
 * Append an Architecture Decision Record to authored/decisions/. ADRs are
 * durable and append-only — the MCP assigns the next number and writes the file;
 * it never rewrites an existing ADR. This is how solved decisions stop being
 * re-litigated by future contributors (human or model).
 */
export async function recordDecision(
  layout: PiLayout,
  input: DecisionInput,
): Promise<{ path: string; number: number }> {
  const number = await nextNumber(layout.authored.decisions);
  const path = join(layout.authored.decisions, `${pad(number)}-${slugify(input.title)}.md`);

  const contents = [
    `# ADR-${pad(number)}: ${input.title}`,
    "",
    `- **Status:** ${input.status ?? "Accepted"}`,
    `- **Date:** ${input.now}`,
    "",
    "## Context",
    "",
    input.context.trim(),
    "",
    "## Decision",
    "",
    input.decision.trim(),
    "",
    "## Consequences",
    "",
    input.consequences.trim(),
    "",
  ].join("\n");

  await writeFileAtomic(path, contents);
  return { path, number };
}

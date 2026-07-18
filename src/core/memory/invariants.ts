import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { readTextIfExists, writeFileAtomic } from "../../util/fsx.js";
import { canonicalJson } from "../../util/json.js";
import type { PiLayout } from "../../store/layout.js";
import { nextNumber, pad, slugify } from "./numbering.js";

export interface InvariantInput {
  statement: string;
  rationale: string;
  scope: string;
  now: string;
}

/**
 * Record a durable invariant in authored/invariants/ and refresh the derived
 * machine index over all invariants. Invariants are the constraints that must
 * not break — the kind of knowledge lost forever if it lives only in someone's
 * head. Append-only; the derived index is the only regenerated part.
 */
export async function recordInvariant(
  layout: PiLayout,
  input: InvariantInput,
): Promise<{ path: string }> {
  const number = await nextNumber(layout.authored.invariants);
  const path = join(layout.authored.invariants, `${pad(number)}-${slugify(input.statement)}.md`);

  const contents = [
    `# Invariant: ${input.statement}`,
    "",
    `- **Scope:** ${input.scope}`,
    `- **Recorded:** ${input.now}`,
    "",
    "## Rationale",
    "",
    input.rationale.trim(),
    "",
  ].join("\n");

  await writeFileAtomic(path, contents);
  await rebuildInvariantsIndex(layout);
  return { path };
}

/**
 * Regenerate derived/invariants-index.json from the authored invariant files.
 * This is a derived artifact (safe to delete) that gives tools a fast, structured
 * view over the durable authored invariants.
 */
export async function rebuildInvariantsIndex(layout: PiLayout): Promise<void> {
  const entries: Array<{ file: string; statement: string; scope: string }> = [];
  let files: string[] = [];
  try {
    files = (await readdir(layout.authored.invariants)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    files = [];
  }

  for (const file of files) {
    if (file.toLowerCase() === "readme.md") continue;
    const content = (await readTextIfExists(join(layout.authored.invariants, file))) ?? "";
    const statement = /^#\s+Invariant:\s+(.+)$/m.exec(content)?.[1]?.trim() ?? /^#\s+(.+)$/m.exec(content)?.[1]?.trim() ?? file;
    const scope = /\*\*Scope:\*\*\s+(.+)$/m.exec(content)?.[1]?.trim() ?? "unspecified";
    entries.push({ file, statement, scope });
  }

  await writeFileAtomic(layout.derived.invariantsIndexJson, canonicalJson({ invariants: entries }));
}

import { join } from "node:path";
import { writeFileAtomic } from "../../util/fsx.js";
import type { PiLayout } from "../../store/layout.js";
import { nextNumber, pad, slugify } from "./numbering.js";

export interface SessionNote {
  kind: string; // e.g. "note", "validation", "evidence"
  title: string;
  body: string;
  /** ISO timestamp captured by the caller (kept out of deterministic bodies). */
  now: string;
  evidenceRefs?: string[];
}

/**
 * Append a session note to memory/sessions/. Sessions are append-only history —
 * lightweight records of what happened (a validation run, an evidence capture, a
 * freeform note). Returns the created file's absolute path.
 */
export async function appendSession(layout: PiLayout, note: SessionNote): Promise<string> {
  const n = await nextNumber(layout.memory.sessions);
  const file = join(layout.memory.sessions, `${pad(n)}-${note.kind}-${slugify(note.title)}.md`);

  const refs = note.evidenceRefs?.length
    ? ["", "**Evidence:**", ...note.evidenceRefs.map((r) => `- ${r}`)].join("\n")
    : "";

  const contents = [
    `# ${note.title}`,
    "",
    `- **Kind:** ${note.kind}`,
    `- **Recorded:** ${note.now}`,
    "",
    note.body,
    refs,
    "",
  ].join("\n");

  await writeFileAtomic(file, contents);
  return file;
}

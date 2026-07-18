import { join } from "node:path";
import { readdir } from "node:fs/promises";
import type { ContextItemKind } from "../domain/schemas.js";
import { readTextIfExists } from "../util/fsx.js";
import type { PiLayout } from "./layout.js";

export interface KnowledgeDoc {
  kind: ContextItemKind;
  path: string; // repo-relative
  title: string;
  content: string;
}

/**
 * Read all durable, human/host-authored knowledge from authored/. These docs are
 * candidates for context compilation: ADRs, invariants, policies, requirements,
 * roadmap, and glossary. Order is deterministic (path-sorted). Missing dirs are
 * simply empty — a freshly-initialised repo has no authored knowledge yet.
 */
export async function readAuthoredKnowledge(layout: PiLayout, repoPath: string): Promise<KnowledgeDoc[]> {
  const sources: Array<{ dir: string; kind: ContextItemKind }> = [
    { dir: layout.authored.decisions, kind: "adr" },
    { dir: layout.authored.invariants, kind: "invariant" },
    { dir: layout.authored.policies, kind: "policy" },
    { dir: layout.authored.requirements, kind: "requirement" },
    { dir: layout.authored.roadmap, kind: "roadmap" },
    { dir: layout.authored.glossary, kind: "glossary" },
  ];

  const docs: KnowledgeDoc[] = [];
  for (const { dir, kind } of sources) {
    for (const file of await listMarkdown(dir)) {
      const abs = join(dir, file);
      const content = await readTextIfExists(abs);
      if (content === null) continue;
      docs.push({
        kind,
        path: toRepoRel(repoPath, abs),
        title: firstHeading(content) ?? file.replace(/\.md$/, ""),
        content,
      });
    }
  }
  docs.sort((a, b) => (a.path < b.path ? -1 : 1));
  return docs;
}

async function listMarkdown(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

function firstHeading(md: string): string | null {
  const m = /^#\s+(.+)$/m.exec(md);
  return m?.[1]?.trim() ?? null;
}

function toRepoRel(repoPath: string, abs: string): string {
  const rel = abs.startsWith(repoPath) ? abs.slice(repoPath.length).replace(/^[/\\]/, "") : abs;
  return rel.split("\\").join("/");
}

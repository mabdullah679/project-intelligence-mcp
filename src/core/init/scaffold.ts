import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { ensureDir, pathExists, readTextIfExists, writeFileAtomic } from "../../util/fsx.js";
import { canonicalJson } from "../../util/json.js";
import { defaultConfig } from "../../config/config.js";
import { emptyManifest } from "../../store/manifest.js";
import { piLayout, scaffoldDirs, type PiLayout } from "../../store/layout.js";

export interface ScaffoldResult {
  created: string[];
  skipped: string[];
}

/**
 * Scaffold the project-intelligence directory. Idempotent: existing files are
 * skipped, never overwritten, so re-running init on a populated repo is safe.
 * Seeds durable authored/ templates (ADR guide, glossary, ownership) plus a
 * default config and an empty manifest.
 */
export async function scaffold(repoPath: string, dirName: string): Promise<ScaffoldResult> {
  const layout = piLayout(repoPath, dirName);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const dir of scaffoldDirs(layout)) await ensureDir(dir);

  const cfg = defaultConfig();
  cfg.dirName = dirName;

  const ownershipSeed = await seedOwnership(repoPath);

  const files: Array<{ path: string; contents: string }> = [
    { path: layout.configFile, contents: canonicalJson(cfg) },
    { path: layout.manifestFile, contents: canonicalJson(emptyManifest(dirName)) },
    { path: join(layout.root, "README.md"), contents: README(dirName) },
    { path: join(layout.authored.decisions, "0000-record-architecture-decisions.md"), contents: ADR_GUIDE },
    { path: join(layout.authored.glossary, "glossary.md"), contents: GLOSSARY_STUB },
    { path: join(layout.authored.ownership, "ownership.md"), contents: ownershipSeed },
    { path: join(layout.authored.invariants, "README.md"), contents: INVARIANTS_STUB },
    { path: join(layout.authored.policies, "README.md"), contents: POLICIES_STUB },
    { path: join(layout.authored.requirements, "README.md"), contents: REQUIREMENTS_STUB },
    { path: join(layout.authored.roadmap, "roadmap.md"), contents: ROADMAP_STUB },
    { path: join(layout.derived.root, ".gitkeep"), contents: "" },
  ];

  for (const f of files) {
    if (await pathExists(f.path)) {
      skipped.push(f.path);
    } else {
      await writeFileAtomic(f.path, f.contents);
      created.push(f.path);
    }
  }

  return { created, skipped };
}

export async function isInitialized(layout: PiLayout): Promise<boolean> {
  return pathExists(layout.configFile);
}

async function seedOwnership(repoPath: string): Promise<string> {
  for (const rel of ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"]) {
    const raw = await readTextIfExists(join(repoPath, rel));
    if (raw) {
      return `# Ownership\n\nSeeded from \`${rel}\`. Curate as needed.\n\n\`\`\`\n${raw.trim()}\n\`\`\`\n`;
    }
  }
  return OWNERSHIP_STUB;
}

/** True if the directory has no entries (used to decide whether to seed). */
export async function isEmptyDir(dir: string): Promise<boolean> {
  try {
    return (await readdir(dir)).length === 0;
  } catch {
    return true;
  }
}

const README = (dirName: string) => `# Project Intelligence (\`${dirName}/\`)

This directory is the deterministic knowledge base for this repository, maintained
by the Project Intelligence MCP. It is split by **durability**:

- \`authored/\` — durable, human/host-authored knowledge. **Append-only**; the MCP
  never overwrites it. ADRs, invariants, policies, requirements, roadmap, glossary,
  ownership.
- \`derived/\` — MCP-generated artifacts (repository summary, indexes, dependency &
  architecture graphs, component catalog). **Fully regenerable** from the repo;
  safe to delete. Each artifact is written as canonical JSON (source of truth) and
  rendered Markdown (for review).
- \`memory/\` — append-only history: sessions, sprint checkpoints, and graph
  snapshots used to compute sprint deltas.

Regeneration only ever writes inside \`derived/\` and \`memory/snapshots/\`, so your
authored knowledge is never at risk.
`;

const ADR_GUIDE = `# ADR-0000: Record architecture decisions

## Status
Accepted

## Context
We want a durable, reviewable record of significant technical decisions so a
future contributor (human or model) never has to re-derive why something is the
way it is.

## Decision
Record each significant decision as a numbered Markdown file in this directory
(\`NNNN-title.md\`), created via the MCP \`decision.record\` tool. ADRs are
append-only and immutable once accepted; supersede rather than edit.

## Consequences
- Decisions are diffable and travel with the code.
- The context compiler can surface relevant ADRs alongside code for a task.
`;

const GLOSSARY_STUB = `# Glossary

Define project-specific terminology here so models and newcomers share vocabulary.

| Term | Definition |
| --- | --- |
`;

const OWNERSHIP_STUB = `# Ownership

No \`CODEOWNERS\` file was found. Record who owns which areas of the codebase here,
or add a \`CODEOWNERS\` file and re-run \`intel.init\` to seed this automatically.
`;

const INVARIANTS_STUB = `# Invariants

Durable, must-not-break constraints of this system. Add entries via the MCP
\`invariant.record\` tool. Examples: "all money amounts are integer cents",
"the scheduler is single-writer".
`;

const POLICIES_STUB = `# Policies & standards

Coding standards, security policies, and testing policy for this repository.
`;

const REQUIREMENTS_STUB = `# Requirements

Durable product/technical requirements that constrain implementation.
`;

const ROADMAP_STUB = `# Roadmap

Track remaining vs. completed work. Sprint checkpoints reference this file.

## In progress

## Planned

## Completed
`;

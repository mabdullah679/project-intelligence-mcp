import { join } from "node:path";

/**
 * Canonical layout of the project-intelligence directory (default `.pi/`).
 *
 * The top-level split is by DURABILITY, which is the central design decision:
 *   - authored/  human/host-authored, durable, APPEND-ONLY (never auto-overwritten)
 *   - derived/   MCP-generated, fully regenerable from the repo, safe to delete
 *   - memory/    append-only history (sessions, sprints, graph snapshots)
 *
 * Regeneration only ever writes inside derived/ and memory/snapshots/, so a
 * `regenerate` or `sprint.checkpoint` can never destroy human knowledge.
 */
export function piLayout(repoPath: string, dirName = ".pi") {
  const root = join(repoPath, dirName);
  const authored = join(root, "authored");
  const derived = join(root, "derived");
  const memory = join(root, "memory");
  return {
    root,
    configFile: join(root, "config.json"),
    manifestFile: join(root, "manifest.json"),

    authored: {
      root: authored,
      decisions: join(authored, "decisions"),
      invariants: join(authored, "invariants"),
      policies: join(authored, "policies"),
      requirements: join(authored, "requirements"),
      glossary: join(authored, "glossary"),
      ownership: join(authored, "ownership"),
      roadmap: join(authored, "roadmap"),
    },

    derived: {
      root: derived,
      repositorySummaryJson: join(derived, "repository-summary.json"),
      repositorySummaryMd: join(derived, "repository-summary.md"),
      fileIndexJson: join(derived, "file-index.json"),
      languageStatsJson: join(derived, "language-stats.json"),
      languageStatsMd: join(derived, "language-stats.md"),
      dependencyGraphJson: join(derived, "dependency-graph.json"),
      dependencyGraphMd: join(derived, "dependency-graph.md"),
      architectureJson: join(derived, "architecture.json"),
      architectureMd: join(derived, "architecture.md"),
      componentCatalogJson: join(derived, "component-catalog.json"),
      componentCatalogMd: join(derived, "component-catalog.md"),
      invariantsIndexJson: join(derived, "invariants-index.json"),
    },

    memory: {
      root: memory,
      sessions: join(memory, "sessions"),
      sprints: join(memory, "sprints"),
      snapshots: join(memory, "snapshots"),
    },
  } as const;
}

export type PiLayout = ReturnType<typeof piLayout>;

/** The set of directories that `intel.init` scaffolds. */
export function scaffoldDirs(layout: PiLayout): string[] {
  return [
    layout.root,
    layout.authored.root,
    layout.authored.decisions,
    layout.authored.invariants,
    layout.authored.policies,
    layout.authored.requirements,
    layout.authored.glossary,
    layout.authored.ownership,
    layout.authored.roadmap,
    layout.derived.root,
    layout.memory.root,
    layout.memory.sessions,
    layout.memory.sprints,
    layout.memory.snapshots,
  ];
}

import { join } from "node:path";
import { readdir } from "node:fs/promises";
import type { Config } from "../../config/config.js";
import { readTextIfExists, writeFileAtomic } from "../../util/fsx.js";
import { canonicalJson } from "../../util/json.js";
import type { PiLayout } from "../../store/layout.js";
import { runAnalysis } from "../pipeline.js";
import { buildComponentCatalog } from "../discover/catalog.js";
import {
  persistArchitecture,
  persistComponentCatalog,
  persistDependencyGraph,
  persistScan,
} from "../../store/store.js";
import { nextNumber, pad, slugify } from "./numbering.js";
import { recordDecision } from "./decisions.js";

/** Compact fingerprint of repository state used to compute sprint-to-sprint deltas. */
export interface SprintSnapshot {
  scanHash: string;
  modules: string[];
  files: string[];
  externalDeps: string[];
  tests: string[];
  languages: string[];
  invariants: string[];
  edgeCount: number;
}

export interface SprintNarrative {
  summary: string;
  decisions?: Array<{ title: string; context: string; decision: string; consequences: string }>;
  debt?: string[];
  roadmapDelta?: string;
  risks?: string[];
}

export interface SprintDelta {
  isInitial: boolean;
  addedModules: string[];
  removedModules: string[];
  addedFiles: number;
  removedFiles: number;
  addedExternalDeps: string[];
  removedExternalDeps: string[];
  addedTests: number;
  removedTests: number;
  addedLanguages: string[];
  removedLanguages: string[];
  addedInvariants: string[];
  removedInvariants: string[];
  edgeCountDelta: number;
}

function diffSets(prev: string[], next: string[]): { added: string[]; removed: string[] } {
  const p = new Set(prev);
  const n = new Set(next);
  return {
    added: next.filter((x) => !p.has(x)).sort(),
    removed: prev.filter((x) => !n.has(x)).sort(),
  };
}

function computeDelta(prev: SprintSnapshot | null, next: SprintSnapshot): SprintDelta {
  if (!prev) {
    return {
      isInitial: true,
      addedModules: next.modules,
      removedModules: [],
      addedFiles: next.files.length,
      removedFiles: 0,
      addedExternalDeps: next.externalDeps,
      removedExternalDeps: [],
      addedTests: next.tests.length,
      removedTests: 0,
      addedLanguages: next.languages,
      removedLanguages: [],
      addedInvariants: next.invariants,
      removedInvariants: [],
      edgeCountDelta: next.edgeCount,
    };
  }
  const modules = diffSets(prev.modules, next.modules);
  const files = diffSets(prev.files, next.files);
  const deps = diffSets(prev.externalDeps, next.externalDeps);
  const tests = diffSets(prev.tests, next.tests);
  const langs = diffSets(prev.languages, next.languages);
  const invs = diffSets(prev.invariants, next.invariants);
  return {
    isInitial: false,
    addedModules: modules.added,
    removedModules: modules.removed,
    addedFiles: files.added.length,
    removedFiles: files.removed.length,
    addedExternalDeps: deps.added,
    removedExternalDeps: deps.removed,
    addedTests: tests.added.length,
    removedTests: tests.removed.length,
    addedLanguages: langs.added,
    removedLanguages: langs.removed,
    addedInvariants: invs.added,
    removedInvariants: invs.removed,
    edgeCountDelta: next.edgeCount - prev.edgeCount,
  };
}

async function readInvariantStatements(layout: PiLayout): Promise<string[]> {
  let files: string[] = [];
  try {
    files = (await readdir(layout.authored.invariants)).filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const file of files) {
    if (file.toLowerCase() === "readme.md") continue;
    const content = (await readTextIfExists(join(layout.authored.invariants, file))) ?? "";
    const stmt = /^#\s+Invariant:\s+(.+)$/m.exec(content)?.[1]?.trim();
    if (stmt) out.push(stmt);
  }
  return out.sort();
}

async function readLatestSnapshot(layout: PiLayout): Promise<SprintSnapshot | null> {
  let files: string[] = [];
  try {
    files = (await readdir(layout.memory.snapshots)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return null;
  }
  const last = files[files.length - 1];
  if (!last) return null;
  const raw = await readTextIfExists(join(layout.memory.snapshots, last));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SprintSnapshot;
  } catch {
    return null;
  }
}

/**
 * Perform a sprint checkpoint. This respects the core boundary: the MCP computes
 * the deterministic delta between now and the last snapshot, while the host
 * supplies the narrative (decisions, debt, roadmap, risks). It then persists the
 * sprint record, records any provided decisions as ADRs, regenerates derived
 * artifacts, and writes a fresh snapshot — all in reviewable git diffs.
 */
export async function sprintCheckpoint(
  repoPath: string,
  config: Config,
  layout: PiLayout,
  narrative: SprintNarrative,
  now: string,
): Promise<{ sprintPath: string; snapshotPath: string; delta: SprintDelta; regenerated: string[]; adrs: number[] }> {
  const { scan, deps, arch } = await runAnalysis(repoPath, config);
  const catalog = await buildComponentCatalog(scan, arch, repoPath);
  const invariants = await readInvariantStatements(layout);

  const snapshot: SprintSnapshot = {
    scanHash: scan.scanHash,
    modules: arch.modules.map((m) => m.id).sort(),
    files: scan.files.map((f) => f.path).sort(),
    externalDeps: deps.externalDeps.map((d) => d.name).sort(),
    tests: scan.files.filter((f) => f.isTest).map((f) => f.path).sort(),
    languages: Object.keys(scan.languages).sort(),
    invariants,
    edgeCount: deps.edges.length,
  };

  const prev = await readLatestSnapshot(layout);
  const delta = computeDelta(prev, snapshot);

  // Record any host-provided decisions as durable ADRs.
  const adrs: number[] = [];
  for (const d of narrative.decisions ?? []) {
    const { number } = await recordDecision(layout, { ...d, now });
    adrs.push(number);
  }

  // Regenerate derived artifacts (safe: derived/ only).
  const regenerated: string[] = [];
  regenerated.push(...(await persistScan(layout, scan)));
  regenerated.push(...(await persistDependencyGraph(layout, deps)));
  regenerated.push(...(await persistArchitecture(layout, arch)));
  regenerated.push(...(await persistComponentCatalog(layout, catalog)));

  // Write the sprint record (computed delta + host narrative).
  const number = await nextNumber(layout.memory.sprints);
  const sprintPath = join(layout.memory.sprints, `${pad(number)}-${slugify(narrative.summary)}.md`);
  await writeFileAtomic(sprintPath, renderSprint(number, now, narrative, delta, adrs));

  // Persist the fresh snapshot for the next checkpoint's delta.
  const snapshotPath = join(layout.memory.snapshots, `${pad(number)}.json`);
  await writeFileAtomic(snapshotPath, canonicalJson(snapshot));

  return { sprintPath, snapshotPath, delta, regenerated, adrs };
}

function renderSprint(
  number: number,
  now: string,
  narrative: SprintNarrative,
  delta: SprintDelta,
  adrs: number[],
): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "_none_");
  const section = (title: string, body: string) => `## ${title}\n\n${body}\n`;

  const deltaBody = [
    `- **Baseline:** ${delta.isInitial ? "initial checkpoint (no prior snapshot)" : "vs previous snapshot"}`,
    `- **Modules:** +${delta.addedModules.length} / -${delta.removedModules.length}`,
    `- **Files:** +${delta.addedFiles} / -${delta.removedFiles}`,
    `- **Tests:** +${delta.addedTests} / -${delta.removedTests}`,
    `- **Dependency edges:** ${delta.edgeCountDelta >= 0 ? "+" : ""}${delta.edgeCountDelta}`,
    `- **External deps added:** ${delta.addedExternalDeps.join(", ") || "none"}`,
    `- **External deps removed:** ${delta.removedExternalDeps.join(", ") || "none"}`,
    `- **Languages added:** ${delta.addedLanguages.join(", ") || "none"}`,
    `- **New invariants:** ${delta.addedInvariants.join("; ") || "none"}`,
  ].join("\n");

  const headerLines = [`# Sprint ${pad(number)}: ${narrative.summary}`, "", `- **Recorded:** ${now}`];
  if (adrs.length) headerLines.push(`- **ADRs recorded:** ${adrs.map((n) => `ADR-${pad(n)}`).join(", ")}`);

  return [
    headerLines.join("\n"),
    section("Computed delta (deterministic)", deltaBody),
    section("Summary", narrative.summary.trim()),
    section("Technical debt", list(narrative.debt ?? [])),
    section("Roadmap change", narrative.roadmapDelta?.trim() || "_none_"),
    section("Risks", list(narrative.risks ?? [])),
  ].join("\n\n");
}

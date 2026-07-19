import { join } from "node:path";
import type {
  CompiledContext,
  ContextItem,
  DependencyGraph,
  FileRecord,
  RepoScan,
  ScoreBreakdown,
} from "../../domain/schemas.js";
import type { KnowledgeDoc } from "../../store/authored.js";
import { GENERATORS } from "../../domain/version.js";
import { estimateTokens } from "../../util/tokens.js";
import { readTextIfExists } from "../../util/fsx.js";
import { splitIdentifier, stem, stemSet, tokenizeTask } from "./tokenize.js";

export interface CompileInput {
  repoPath: string;
  task: string;
  hints?: { paths?: string[]; symbols?: string[] };
  budgetTokens: number;
  charsPerToken: number;
  maxHops: number;
  maxItems: number;
  scan: RepoScan;
  deps: DependencyGraph;
  knowledge: KnowledgeDoc[];
}

// Scoring weights — deterministic, documented so ranking is auditable.
// Lexical relevance (filename, symbols, keyword coverage) intentionally dominates
// graph proximity and centrality, so a file that literally implements the task
// outranks a merely well-connected neighbour.
const W = {
  filenameToken: 4, // task term appears in the file's basename — strong signal
  pathToken: 1, // task term elsewhere in the path
  symbolExact: 5, // a symbol's whole name equals a task term
  symbolPartial: 2, // a symbol name contains a task term
  hintPathExact: 12, // caller explicitly hinted this path
  keywordCoverage: 2, // per distinct task term the file touches (breadth of relevance)
  graphBase: 3, // seed neighbour base score
  graphDecay: 0.4, // per-hop decay
  centralityUnit: 0.1, // per-degree tie-breaker toward connected files
  centralityCap: 10,
  knowledgeKeyword: 3,
  knowledgeReference: 4,
};

const OVERSIZE_FRACTION = 0.35;

interface Candidate {
  path: string;
  kind: ContextItem["kind"];
  breakdown: ScoreBreakdown;
  score: number;
  reason: string[];
  file?: FileRecord;
  doc?: KnowledgeDoc;
}

function emptyBreakdown(): ScoreBreakdown {
  return { keyword: 0, symbol: 0, path: 0, graph: 0, centrality: 0, knowledge: 0 };
}

function total(b: ScoreBreakdown): number {
  return b.keyword + b.symbol + b.path + b.graph + b.centrality + b.knowledge;
}

/**
 * Compile the smallest complete context for a task. Fully deterministic: seeds
 * come from lexical matches against the symbol/path index, expansion walks the
 * dependency graph, and everything is bounded by the token budget. No LLM is
 * ever consulted — the host model receives the result and does the reasoning.
 */
export async function compileContext(input: CompileInput): Promise<CompiledContext> {
  const warnings: string[] = [];
  const keywords = new Set([
    ...tokenizeTask(input.task),
    ...(input.hints?.symbols ?? []).flatMap(splitIdentifier),
  ]);
  const hintPaths = (input.hints?.paths ?? []).map((p) => p.replace(/\\/g, "/"));

  // ---- 1. Base (seed) scoring over code files ----
  // All matching is done on stems so plural/verb inflections align (e.g.
  // `dependencies`↔`dependency`, `imports`↔`import`).
  const keywordStems = stemSet(keywords);
  const candidates = new Map<string, Candidate>();
  const degree = fileDegrees(input.deps);

  for (const file of input.scan.files) {
    const b = emptyBreakdown();
    const reasons: string[] = [];
    const touched = new Set<string>();

    const basename = file.path.split("/").pop() ?? file.path;
    const filenameStems = stemSet(splitIdentifier(basename));
    const pathStems = stemSet(splitIdentifier(file.path));

    let filenameHits = 0;
    for (const s of filenameStems) if (keywordStems.has(s)) (filenameHits++, touched.add(s));
    if (filenameHits > 0) {
      b.path += filenameHits * W.filenameToken;
      reasons.push(`filename matches ${filenameHits} task term(s)`);
    }
    let pathHits = 0;
    for (const s of pathStems) if (keywordStems.has(s) && !filenameStems.has(s)) (pathHits++, touched.add(s));
    if (pathHits > 0) b.path += pathHits * W.pathToken;

    const hintExact = hintPaths.some((h) => file.path === h || file.path.endsWith(`/${h}`) || file.path.endsWith(h));
    if (hintExact) {
      b.path += W.hintPathExact;
      reasons.push("explicitly hinted path");
    }

    let exact = 0;
    let partial = 0;
    for (const sym of file.symbols) {
      if (keywordStems.has(stem(sym.name))) {
        exact++;
        touched.add(stem(sym.name));
      } else {
        let hit = false;
        for (const t of splitIdentifier(sym.name)) {
          if (keywordStems.has(stem(t))) {
            touched.add(stem(t));
            hit = true;
          }
        }
        if (hit) partial++;
      }
    }
    if (exact > 0) {
      b.symbol += exact * W.symbolExact;
      reasons.push(`defines ${exact} symbol(s) named in the task`);
    }
    if (partial > 0) {
      b.symbol += partial * W.symbolPartial;
      reasons.push(`defines ${partial} symbol(s) related to the task`);
    }

    if (touched.size > 0) b.keyword += touched.size * W.keywordCoverage;

    // A file qualifies only on genuine lexical relevance — centrality alone must
    // never make an unrelated file a candidate (it is only a tie-breaker on files
    // that already matched).
    const lexical = b.symbol + b.path + b.keyword;
    if (lexical > 0 || hintExact) {
      const deg = degree.get(file.path) ?? 0;
      if (deg > 0) b.centrality += Math.min(deg, W.centralityCap) * W.centralityUnit;
      candidates.set(file.path, { path: file.path, kind: "code", breakdown: b, score: 0, reason: reasons, file });
    }
  }

  // ---- 2. Graph expansion from seeds ----
  const seeds = [...candidates.values()]
    .filter((c) => c.breakdown.symbol + c.breakdown.path > 0)
    .map((c) => c.path);
  const adjacency = buildAdjacency(input.deps);
  const fileByPath = new Map(input.scan.files.map((f) => [f.path, f]));

  expandFromSeeds(seeds, adjacency, input.maxHops).forEach((hop, path) => {
    if (path && seeds.includes(path)) return;
    const file = fileByPath.get(path);
    if (!file) return;
    const graphScore = W.graphBase * Math.pow(W.graphDecay, hop - 1);
    const existing = candidates.get(path);
    if (existing) {
      existing.breakdown.graph += graphScore;
      existing.reason.push(`${hop} hop(s) from a seed file`);
    } else {
      const b = emptyBreakdown();
      b.graph += graphScore;
      const deg = degree.get(path) ?? 0;
      if (deg > 0) b.centrality += Math.min(deg, W.centralityCap) * W.centralityUnit;
      candidates.set(path, {
        path,
        kind: "code",
        breakdown: b,
        score: 0,
        reason: [`${hop} hop(s) from a seed file`],
        file,
      });
    }
  });

  // ---- 3. Authored-knowledge scoring ----
  const selectedModules = new Set(
    [...candidates.keys()].map((p) => p.split("/")[0]).filter(Boolean) as string[],
  );
  for (const doc of input.knowledge) {
    const b = emptyBreakdown();
    const reasons: string[] = [];
    const docStems = stemSet(splitIdentifier(doc.content));
    let overlap = 0;
    for (const k of keywordStems) if (docStems.has(k)) overlap++;
    if (overlap > 0) {
      b.knowledge += overlap * W.knowledgeKeyword;
      reasons.push(`${doc.kind} overlaps ${overlap} task term(s)`);
    }
    const referencesSelection =
      [...candidates.keys()].some((p) => doc.content.includes(p.split("/").pop() ?? "")) ||
      [...selectedModules].some((m) => m.length > 1 && doc.content.includes(m));
    if (referencesSelection && overlap > 0) {
      b.knowledge += W.knowledgeReference;
      reasons.push("references selected components");
    }
    if (total(b) > 0) {
      candidates.set(doc.path, { path: doc.path, kind: doc.kind, breakdown: b, score: 0, reason: reasons, doc });
    }
  }

  // ---- 4. Rank ----
  const ranked = [...candidates.values()]
    .map((c) => ({ ...c, score: Number(total(c.breakdown).toFixed(3)) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1))
    .slice(0, input.maxItems);

  if (ranked.length === 0) {
    warnings.push("No files or knowledge matched the task lexically; returning an empty context.");
  }

  // ---- 5. Budget-bounded selection ----
  const items: ContextItem[] = [];
  const excluded: CompiledContext["excluded"] = [];
  let usedTokens = 0;
  const totalScore = ranked.reduce((s, c) => s + c.score, 0);
  let includedScore = 0;

  for (const c of ranked) {
    const built = await buildContent(c, input);
    if (built === null) {
      excluded.push({ path: c.path, score: c.score, tokens: 0, reason: "unreadable or binary" });
      continue;
    }
    let { content, disclosure } = built;
    let tokens = estimateTokens(content, input.charsPerToken);

    // Downgrade an oversized code item to a signatures-only view to fit the budget.
    if (c.kind === "code" && tokens > input.budgetTokens * OVERSIZE_FRACTION && c.file) {
      const sig = signatureView(c.file);
      const sigTokens = estimateTokens(sig, input.charsPerToken);
      if (sigTokens < tokens) {
        content = sig;
        tokens = sigTokens;
        disclosure = "signatures";
      }
    }

    if (usedTokens + tokens > input.budgetTokens) {
      excluded.push({ path: c.path, score: c.score, tokens, reason: "exceeds remaining token budget" });
      continue;
    }

    usedTokens += tokens;
    includedScore += c.score;
    items.push({
      path: c.path,
      kind: c.kind,
      reason: c.reason,
      score: c.score,
      breakdown: c.breakdown,
      tokens,
      disclosure,
      content,
    });
  }

  const coverage = totalScore === 0 ? 0 : Number((includedScore / totalScore).toFixed(3));

  return {
    manifest: {
      task: input.task,
      seeds,
      budgetTokens: input.budgetTokens,
      includedTokens: usedTokens,
      itemCount: items.length,
      coverage,
      strategy: `${GENERATORS.context} seed→expand(${input.maxHops})→score→budget`,
    },
    items,
    excluded,
    warnings,
  };
}

/* ---------------- helpers ---------------- */

function fileDegrees(deps: DependencyGraph): Map<string, number> {
  const deg = new Map<string, number>();
  for (const e of deps.edges) {
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  }
  return deg;
}

function buildAdjacency(deps: DependencyGraph): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
  };
  for (const e of deps.edges) {
    link(e.from, e.to);
    link(e.to, e.from); // undirected walk: callers and callees are both relevant
  }
  return adj;
}

/** BFS returning the minimum hop distance (1..maxHops) of each reachable file. */
function expandFromSeeds(
  seeds: string[],
  adjacency: Map<string, Set<string>>,
  maxHops: number,
): Map<string, number> {
  const hop = new Map<string, number>();
  let frontier = new Set(seeds);
  for (let h = 1; h <= maxHops; h++) {
    const next = new Set<string>();
    for (const node of frontier) {
      for (const neighbor of adjacency.get(node) ?? []) {
        if (!hop.has(neighbor) && !seeds.includes(neighbor)) {
          hop.set(neighbor, h);
          next.add(neighbor);
        }
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }
  return hop;
}

async function buildContent(
  c: Candidate,
  input: CompileInput,
): Promise<{ content: string; disclosure: ContextItem["disclosure"] } | null> {
  if (c.doc) {
    return { content: c.doc.content, disclosure: "full" };
  }
  if (c.file) {
    const abs = join(input.repoPath, c.file.path);
    const text = await readTextIfExists(abs);
    if (text === null) return null;
    return { content: `// ${c.file.path}\n${text}`, disclosure: "full" };
  }
  return null;
}

/** A compact signatures-only view of a code file (imports + top-level symbols). */
function signatureView(file: FileRecord): string {
  const lines = [`// ${file.path} (signatures only)`];
  if (file.imports.length) {
    lines.push(`// imports: ${[...new Set(file.imports.map((i) => i.module))].join(", ")}`);
  }
  for (const s of file.symbols) {
    lines.push(`${s.exported ? "export " : ""}${s.kind} ${s.name}  // line ${s.line + 1}`);
  }
  if (file.symbols.length === 0) lines.push("// (no top-level symbols extracted)");
  return lines.join("\n");
}

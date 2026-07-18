import { z } from "zod";

/**
 * The core data model. Zod schemas are the single source of truth: they validate
 * MCP tool payloads at runtime AND produce the TypeScript types used throughout
 * the codebase (via z.infer). One definition, no drift.
 */

/** Analysis confidence for a per-file result. */
export const Confidence = z.enum(["high", "low", "none"]);
export type Confidence = z.infer<typeof Confidence>;

export const SymbolSchema = z.object({
  name: z.string(),
  kind: z.string(), // function | class | method | interface | struct | enum | const | ...
  line: z.number().int().nonnegative(),
  exported: z.boolean(),
});
export type SymbolRecord = z.infer<typeof SymbolSchema>;

export const ImportRefSchema = z.object({
  /** The raw imported module string as written in source, e.g. "./foo" or "os". */
  module: z.string(),
  line: z.number().int().nonnegative(),
  /** Repo-relative path this import resolved to, or null if external/unresolved. */
  resolved: z.string().nullable(),
  external: z.boolean(),
});
export type ImportRef = z.infer<typeof ImportRefSchema>;

export const FileRecordSchema = z.object({
  path: z.string(), // repo-relative, posix separators
  lang: z.string(),
  ext: z.string(),
  size: z.number().int().nonnegative(),
  loc: z.number().int().nonnegative(),
  hash: z.string(),
  isTest: z.boolean(),
  isDoc: z.boolean(),
  isConfig: z.boolean(),
  isEntrypoint: z.boolean(),
  symbols: z.array(SymbolSchema),
  imports: z.array(ImportRefSchema),
  confidence: Confidence,
});
export type FileRecord = z.infer<typeof FileRecordSchema>;

export const LanguageStatSchema = z.object({
  files: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  loc: z.number().int().nonnegative(),
});
export type LanguageStat = z.infer<typeof LanguageStatSchema>;

export const RepoScanSchema = z.object({
  repoPath: z.string(),
  fileCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  languages: z.record(z.string(), LanguageStatSchema),
  files: z.array(FileRecordSchema),
  scanHash: z.string(),
  generator: z.string(),
});
export type RepoScan = z.infer<typeof RepoScanSchema>;

/* ---------- dependency graph ---------- */

export const DepNodeSchema = z.object({
  id: z.string(), // repo-relative path
  lang: z.string(),
  module: z.string(), // owning module id
});
export const DepEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
});
export const ExternalDepSchema = z.object({
  name: z.string(),
  source: z.string(), // manifest that declared it
  version: z.string().nullable(),
});
export const DependencyGraphSchema = z.object({
  nodes: z.array(DepNodeSchema),
  edges: z.array(DepEdgeSchema),
  externalDeps: z.array(ExternalDepSchema),
  cycles: z.array(z.array(z.string())),
  unresolvedImports: z.number().int().nonnegative(),
  generator: z.string(),
});
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;

/* ---------- architecture graph ---------- */

export const ModuleSchema = z.object({
  id: z.string(),
  path: z.string(),
  fileCount: z.number().int().nonnegative(),
  languages: z.array(z.string()),
});
export const ModuleEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  weight: z.number().int().positive(),
});
export const ModuleMetricSchema = z.object({
  fanIn: z.number().int().nonnegative(),
  fanOut: z.number().int().nonnegative(),
  /** Instability = fanOut / (fanIn + fanOut), 0 = stable, 1 = unstable. */
  instability: z.number().min(0).max(1),
});
export const ArchitectureGraphSchema = z.object({
  modules: z.array(ModuleSchema),
  edges: z.array(ModuleEdgeSchema),
  cycles: z.array(z.array(z.string())),
  layers: z.array(z.array(z.string())),
  metrics: z.record(z.string(), ModuleMetricSchema),
  generator: z.string(),
});
export type ArchitectureGraph = z.infer<typeof ArchitectureGraphSchema>;

/* ---------- context compilation ---------- */

export const ContextItemKind = z.enum([
  "code",
  "adr",
  "invariant",
  "policy",
  "roadmap",
  "glossary",
  "requirement",
]);
export type ContextItemKind = z.infer<typeof ContextItemKind>;

export const ScoreBreakdownSchema = z.object({
  keyword: z.number(),
  symbol: z.number(),
  path: z.number(),
  graph: z.number(),
  centrality: z.number(),
  knowledge: z.number(),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const ContextItemSchema = z.object({
  path: z.string(),
  kind: ContextItemKind,
  reason: z.array(z.string()),
  score: z.number(),
  breakdown: ScoreBreakdownSchema,
  tokens: z.number().int().nonnegative(),
  disclosure: z.enum(["full", "signatures", "summary"]),
  content: z.string(),
});
export type ContextItem = z.infer<typeof ContextItemSchema>;

export const ExcludedItemSchema = z.object({
  path: z.string(),
  score: z.number(),
  tokens: z.number().int().nonnegative(),
  reason: z.string(),
});

export const ContextManifestSchema = z.object({
  task: z.string(),
  seeds: z.array(z.string()),
  budgetTokens: z.number().int().nonnegative(),
  includedTokens: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  /** Fraction of relevant-and-scored material that fit in the budget (0..1). */
  coverage: z.number().min(0).max(1),
  strategy: z.string(),
});
export type ContextManifest = z.infer<typeof ContextManifestSchema>;

export const CompiledContextSchema = z.object({
  manifest: ContextManifestSchema,
  items: z.array(ContextItemSchema),
  excluded: z.array(ExcludedItemSchema),
  warnings: z.array(z.string()),
});
export type CompiledContext = z.infer<typeof CompiledContextSchema>;

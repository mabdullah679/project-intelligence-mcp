import { join } from "node:path";
import { z } from "zod";
import { readTextIfExists } from "../util/fsx.js";
import { log } from "../util/logger.js";

/**
 * Configuration schema. This is where ALL host-model-specific behavior lives.
 * The MCP has no per-vendor code paths: swapping Claude <-> GPT <-> Qwen <-> a
 * local model is purely a change to `host` (context window, budget, tokenizer
 * ratio, style hint). Everything else tunes deterministic analysis.
 */
export const HostConfigSchema = z.object({
  /** The host model's total context window in tokens (sizing ceiling). */
  contextWindowTokens: z.number().int().positive().default(200_000),
  /** Default token budget for a single context.compile call. */
  tokenBudget: z.number().int().positive().default(24_000),
  /** Characters-per-token ratio for offline token estimation (model-specific). */
  charsPerToken: z.number().positive().default(3.8),
  /** Advisory output-style hint passed through to the host; MCP does not act on it. */
  outputStyle: z.enum(["concise", "detailed"]).default("concise"),
});

export const ScanConfigSchema = z.object({
  /** Extra ignore globs, layered on top of .gitignore. */
  ignore: z.array(z.string()).default([]),
  includeHidden: z.boolean().default(false),
  /** Files larger than this are indexed but not parsed (bytes). */
  maxFileSizeBytes: z.number().int().positive().default(1_500_000),
  followSymlinks: z.boolean().default(false),
});

export const AnalysisConfigSchema = z.object({
  /** Directory-prefix hints that force module boundaries, e.g. ["packages", "services"]. */
  boundaryHints: z.array(z.string()).default([]),
  /** Absolute path to the grammars directory; resolved to the bundled one if empty. */
  grammarsDir: z.string().default(""),
});

export const ValidationConfigSchema = z.object({
  test: z.string().optional(),
  lint: z.string().optional(),
  build: z.string().optional(),
  custom: z.record(z.string(), z.string()).default({}),
});

export const ContextConfigSchema = z.object({
  /** Max dependency-graph hops to expand from seed files. */
  maxHops: z.number().int().nonnegative().default(2),
  /** Hard cap on number of items regardless of budget. */
  maxItems: z.number().int().positive().default(60),
});

export const ConfigSchema = z.object({
  version: z.string().default("1"),
  dirName: z.string().default(".pi"),
  host: HostConfigSchema.default({}),
  scan: ScanConfigSchema.default({}),
  analysis: AnalysisConfigSchema.default({}),
  validation: ValidationConfigSchema.default({}),
  context: ContextConfigSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

/** Fully-defaulted config, used when a repo has no config.json yet. */
export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}

/**
 * Load `.pi/config.json` from a repo, applying schema defaults. Missing file =>
 * defaults. Malformed file => defaults + a warning (never throws): the tool
 * surface must stay usable even with a broken config.
 */
export async function loadConfig(repoPath: string, dirName = ".pi"): Promise<Config> {
  const path = join(repoPath, dirName, "config.json");
  const raw = await readTextIfExists(path);
  if (raw === null) return defaultConfig();
  try {
    const parsed = ConfigSchema.parse(JSON.parse(raw));
    // Persisted dirName wins so downstream path resolution stays consistent.
    return { ...parsed, dirName };
  } catch (err) {
    log.warn("invalid .pi/config.json, using defaults", { error: String(err) });
    return { ...defaultConfig(), dirName };
  }
}

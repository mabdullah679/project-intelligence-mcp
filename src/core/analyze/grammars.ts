import Parser from "web-tree-sitter";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { pathExists } from "../../util/fsx.js";
import { grammarForLanguage } from "../../domain/languages.js";
import { log } from "../../util/logger.js";

/**
 * Loads and caches tree-sitter WASM grammars. Everything here is offline: the
 * core runtime and every grammar are `.wasm` files shipped under grammars/, so
 * there is no native build step and no network access at any point.
 */

let initPromise: Promise<void> | null = null;
const grammarCache = new Map<string, Parser.Language | null>();

function bundledGrammarsDir(): string {
  // Walk up from this module until we find grammars/tree-sitter.wasm. This works
  // regardless of layout depth — src/ under tsx, dist/ after bundling, or
  // node_modules/<pkg>/dist when installed as a dependency.
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "grammars");
    if (existsSync(join(candidate, "tree-sitter.wasm"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Last resort: relative to the current working directory.
  return join(process.cwd(), "grammars");
}

export function resolveGrammarsDir(configured: string): string {
  return configured && configured.length > 0 ? configured : bundledGrammarsDir();
}

async function ensureInit(grammarsDir: string): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init({
      // Point emscripten at our bundled core runtime wasm.
      locateFile: (name: string) => join(grammarsDir, name),
    });
  }
  await initPromise;
}

/**
 * Returns a loaded Language for a canonical language id, or null when no grammar
 * is bundled for it (the caller then falls back to heuristics). Failures are
 * cached as null so we never re-attempt a broken load on every file.
 */
export async function loadGrammar(
  langId: string,
  grammarsDir: string,
): Promise<Parser.Language | null> {
  const grammar = grammarForLanguage(langId);
  if (!grammar) return null;
  if (grammarCache.has(grammar)) return grammarCache.get(grammar) ?? null;

  const wasmPath = join(grammarsDir, `tree-sitter-${grammar}.wasm`);
  if (!(await pathExists(wasmPath))) {
    grammarCache.set(grammar, null);
    return null;
  }
  try {
    await ensureInit(grammarsDir);
    const lang = await Parser.Language.load(wasmPath);
    grammarCache.set(grammar, lang);
    return lang;
  } catch (err) {
    log.warn("failed to load grammar; falling back to heuristics", {
      langId,
      grammar,
      error: String(err),
    });
    grammarCache.set(grammar, null);
    return null;
  }
}

export async function newParser(grammarsDir: string): Promise<Parser> {
  await ensureInit(grammarsDir);
  return new Parser();
}

/** Test/util hook: drop cached grammars (does not un-init the runtime). */
export function clearGrammarCache(): void {
  grammarCache.clear();
}

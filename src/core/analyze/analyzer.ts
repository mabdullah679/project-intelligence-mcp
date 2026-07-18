import type Parser from "web-tree-sitter";
import type { Confidence, SymbolRecord, ImportRef } from "../../domain/schemas.js";
import type { RawFile } from "../scan/walk.js";
import { loadGrammar, newParser } from "./grammars.js";
import { extractImports, extractSymbols } from "./extract.js";
import { fallbackImports, fallbackSymbols } from "./fallback.js";
import { log } from "../../util/logger.js";

export interface FileAnalysis {
  symbols: SymbolRecord[];
  imports: ImportRef[];
  confidence: Confidence;
}

/**
 * The Analyzer owns a single reusable tree-sitter Parser and grammar cache for a
 * scan session. It tries AST extraction first (confidence "high") and degrades
 * to regex heuristics (confidence "low") or nothing (confidence "none") — it
 * NEVER throws on a single file, so one malformed file cannot fail a scan.
 */
export class Analyzer {
  private parser: Parser | null = null;

  constructor(private readonly grammarsDir: string) {}

  async analyze(file: RawFile): Promise<FileAnalysis> {
    if (file.content === null) {
      return { symbols: [], imports: [], confidence: "none" };
    }

    const grammar = await loadGrammar(file.lang, this.grammarsDir);
    if (grammar) {
      try {
        if (!this.parser) this.parser = await newParser(this.grammarsDir);
        this.parser.setLanguage(grammar);
        const tree = this.parser.parse(file.content);
        const root = tree.rootNode;
        const symbols = extractSymbols(root, file.lang);
        const imports = extractImports(root, file.lang);
        tree.delete();
        return { symbols, imports, confidence: "high" };
      } catch (err) {
        log.warn("AST analysis failed; using heuristics", { path: file.path, error: String(err) });
      }
    }

    // Heuristic fallback for unsupported languages or parse failures.
    return {
      symbols: fallbackSymbols(file.content),
      imports: fallbackImports(file.content),
      confidence: "low",
    };
  }

  dispose(): void {
    this.parser?.delete();
    this.parser = null;
  }
}

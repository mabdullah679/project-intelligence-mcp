import type { SymbolRecord, ImportRef } from "../../domain/schemas.js";

/**
 * Regex-based extraction for files with no tree-sitter grammar (unknown stacks)
 * or where a parse failed. Deliberately conservative: it recognises the most
 * common import and declaration syntaxes across languages. Results are always
 * reported at "low" confidence so a consumer knows they are heuristic.
 */

const IMPORT_PATTERNS: RegExp[] = [
  /\bimport\s+.*?\bfrom\s+["'`]([^"'`]+)["'`]/g, // JS/TS: import x from '...'
  /\bimport\s+["'`]([^"'`]+)["'`]/g, // JS side-effect / Go single
  /\brequire\(\s*["'`]([^"'`]+)["'`]\s*\)/g, // CommonJS / Ruby
  /^\s*from\s+([A-Za-z0-9_.]+)\s+import\b/gm, // Python from-import
  /^\s*import\s+([A-Za-z0-9_.]+)/gm, // Python / Java import
  /^\s*use\s+([A-Za-z0-9_:]+)/gm, // Rust / PHP use
  /^\s*#include\s+[<"]([^>"]+)[>"]/gm, // C/C++
];

const SYMBOL_PATTERNS: { re: RegExp; kind: string }[] = [
  { re: /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm, kind: "function" },
  { re: /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm, kind: "class" },
  { re: /^\s*def\s+([A-Za-z_][\w]*)/gm, kind: "function" },
  { re: /^\s*func\s+([A-Za-z_][\w]*)/gm, kind: "function" },
  { re: /^\s*(?:pub\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_][\w]*)/gm, kind: "definition" },
  { re: /^\s*(?:export\s+)?(?:type|interface)\s+([A-Za-z_$][\w$]*)/gm, kind: "type" },
];

function lineOf(text: string, index: number): number {
  let line = 0;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

export function fallbackImports(content: string): ImportRef[] {
  const out: ImportRef[] = [];
  const seen = new Set<string>();
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      const module = m[1];
      if (!module) continue;
      const key = `${module}@${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ module, line: lineOf(content, m.index), resolved: null, external: false });
    }
  }
  return out;
}

export function fallbackSymbols(content: string): SymbolRecord[] {
  const out: SymbolRecord[] = [];
  for (const { re, kind } of SYMBOL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      if (!name) continue;
      out.push({ name, kind, line: lineOf(content, m.index), exported: !name.startsWith("_") });
    }
  }
  return out;
}

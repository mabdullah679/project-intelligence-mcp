/**
 * Language registry: the single source of truth for how the MCP classifies files.
 *
 * This is intentionally data, not code branches. Each entry maps a canonical
 * language id to its file extensions and (optionally) the tree-sitter grammar
 * that gives first-class AST analysis. Languages without a `grammar` still get
 * classified and fall back to heuristic analysis — the MCP is language-agnostic
 * and never fails on an unknown stack, it only lowers its confidence.
 */
export interface LanguageDef {
  id: string;
  displayName: string;
  extensions: string[];
  /** tree-sitter grammar basename under grammars/, or null for heuristic-only. */
  grammar: string | null;
}

export const LANGUAGES: LanguageDef[] = [
  { id: "typescript", displayName: "TypeScript", extensions: [".ts", ".mts", ".cts"], grammar: "typescript" },
  { id: "tsx", displayName: "TSX", extensions: [".tsx"], grammar: "tsx" },
  { id: "javascript", displayName: "JavaScript", extensions: [".js", ".mjs", ".cjs", ".jsx"], grammar: "javascript" },
  { id: "python", displayName: "Python", extensions: [".py", ".pyi"], grammar: "python" },
  { id: "go", displayName: "Go", extensions: [".go"], grammar: "go" },
  { id: "rust", displayName: "Rust", extensions: [".rs"], grammar: "rust" },
  { id: "java", displayName: "Java", extensions: [".java"], grammar: "java" },
  { id: "kotlin", displayName: "Kotlin", extensions: [".kt", ".kts"], grammar: "kotlin" },
  { id: "ruby", displayName: "Ruby", extensions: [".rb"], grammar: "ruby" },
  { id: "php", displayName: "PHP", extensions: [".php"], grammar: "php" },
  { id: "c", displayName: "C", extensions: [".c", ".h"], grammar: "c" },
  { id: "cpp", displayName: "C++", extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hh"], grammar: "cpp" },
  { id: "csharp", displayName: "C#", extensions: [".cs"], grammar: "c_sharp" },
  { id: "swift", displayName: "Swift", extensions: [".swift"], grammar: "swift" },
  { id: "scala", displayName: "Scala", extensions: [".scala", ".sc"], grammar: "scala" },
  { id: "elixir", displayName: "Elixir", extensions: [".ex", ".exs"], grammar: "elixir" },
  { id: "lua", displayName: "Lua", extensions: [".lua"], grammar: "lua" },
  { id: "dart", displayName: "Dart", extensions: [".dart"], grammar: "dart" },
  { id: "zig", displayName: "Zig", extensions: [".zig"], grammar: "zig" },
  { id: "bash", displayName: "Shell", extensions: [".sh", ".bash", ".zsh"], grammar: "bash" },
  { id: "solidity", displayName: "Solidity", extensions: [".sol"], grammar: "solidity" },
  // Classified but heuristic-only (markup / config / data):
  { id: "vue", displayName: "Vue", extensions: [".vue"], grammar: "vue" },
  { id: "html", displayName: "HTML", extensions: [".html", ".htm"], grammar: "html" },
  { id: "css", displayName: "CSS", extensions: [".css", ".scss", ".sass", ".less"], grammar: "css" },
  { id: "json", displayName: "JSON", extensions: [".json"], grammar: "json" },
  { id: "yaml", displayName: "YAML", extensions: [".yaml", ".yml"], grammar: "yaml" },
  { id: "toml", displayName: "TOML", extensions: [".toml"], grammar: "toml" },
  { id: "markdown", displayName: "Markdown", extensions: [".md", ".markdown"], grammar: null },
  { id: "sql", displayName: "SQL", extensions: [".sql"], grammar: null },
];

const EXT_TO_LANG = new Map<string, LanguageDef>();
for (const def of LANGUAGES) {
  for (const ext of def.extensions) EXT_TO_LANG.set(ext, def);
}

const BY_ID = new Map<string, LanguageDef>(LANGUAGES.map((l) => [l.id, l]));

export const UNKNOWN_LANGUAGE = "unknown";

/** Resolve a language definition from a file extension (with leading dot, lowercased). */
export function languageForExtension(ext: string): LanguageDef | undefined {
  return EXT_TO_LANG.get(ext.toLowerCase());
}

export function languageById(id: string): LanguageDef | undefined {
  return BY_ID.get(id);
}

export function grammarForLanguage(id: string): string | null {
  return BY_ID.get(id)?.grammar ?? null;
}

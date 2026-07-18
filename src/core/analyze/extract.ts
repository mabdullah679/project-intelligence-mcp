import type Parser from "web-tree-sitter";
import type { SymbolRecord, ImportRef } from "../../domain/schemas.js";

/**
 * Table-driven AST extraction. Each LanguageSpec names the tree-sitter node types
 * that represent imports and top-level symbols for a language family. Languages
 * with a grammar but no explicit spec fall back to GENERIC_SPEC, which recognises
 * the node-type names common across grammars — partial but genuinely useful, and
 * never wrong about confidence (a real parse still happened).
 */
type Node = Parser.SyntaxNode;

interface LanguageSpec {
  importTypes: string[];
  /** node types whose direct child *_spec nodes carry the real declarations (e.g. Go). */
  containerTypes?: string[];
  symbolKinds: Record<string, string>;
  /** How this language marks something exported/public. */
  exportStyle: "js" | "uppercase" | "modifier" | "visibility" | "always";
}

const IDENTIFIER_TYPES = [
  "identifier",
  "type_identifier",
  "constant",
  "field_identifier",
  "property_identifier",
  "scoped_identifier",
  "name",
];

const STRING_TYPES = [
  "string",
  "string_literal",
  "interpreted_string_literal",
  "raw_string_literal",
  "system_lib_string",
];

const GENERIC_SPEC: LanguageSpec = {
  importTypes: [
    "import_statement",
    "import_from_statement",
    "import_declaration",
    "use_declaration",
    "preproc_include",
  ],
  symbolKinds: {
    function_declaration: "function",
    function_definition: "function",
    function_item: "function",
    method_declaration: "method",
    method_definition: "method",
    class_declaration: "class",
    class_definition: "class",
    class_specifier: "class",
    interface_declaration: "interface",
    struct_item: "struct",
    struct_specifier: "struct",
    enum_declaration: "enum",
    enum_item: "enum",
    type_alias_declaration: "type",
    trait_item: "trait",
    object_declaration: "object",
  },
  exportStyle: "always",
};

const JS_SPEC: LanguageSpec = {
  importTypes: ["import_statement"],
  symbolKinds: {
    function_declaration: "function",
    generator_function_declaration: "function",
    class_declaration: "class",
    interface_declaration: "interface",
    type_alias_declaration: "type",
    enum_declaration: "enum",
    lexical_declaration: "const",
    variable_declaration: "var",
    abstract_class_declaration: "class",
  },
  exportStyle: "js",
};

const PY_SPEC: LanguageSpec = {
  importTypes: ["import_statement", "import_from_statement"],
  symbolKinds: {
    function_definition: "function",
    class_definition: "class",
    decorated_definition: "decorated",
  },
  exportStyle: "always",
};

const GO_SPEC: LanguageSpec = {
  importTypes: ["import_declaration"],
  containerTypes: ["const_declaration", "var_declaration", "type_declaration"],
  symbolKinds: {
    function_declaration: "function",
    method_declaration: "method",
    type_spec: "type",
    const_spec: "const",
    var_spec: "var",
  },
  exportStyle: "uppercase",
};

const RUST_SPEC: LanguageSpec = {
  importTypes: ["use_declaration"],
  symbolKinds: {
    function_item: "function",
    struct_item: "struct",
    enum_item: "enum",
    trait_item: "trait",
    mod_item: "module",
    const_item: "const",
    static_item: "static",
    type_item: "type",
  },
  exportStyle: "visibility",
};

const JAVA_SPEC: LanguageSpec = {
  importTypes: ["import_declaration"],
  symbolKinds: {
    class_declaration: "class",
    interface_declaration: "interface",
    enum_declaration: "enum",
    record_declaration: "record",
    method_declaration: "method",
  },
  exportStyle: "modifier",
};

const RUBY_SPEC: LanguageSpec = {
  importTypes: [], // require() is a call, handled specially below
  symbolKinds: {
    method: "method",
    singleton_method: "method",
    class: "class",
    module: "module",
  },
  exportStyle: "always",
};

const SPECS: Record<string, LanguageSpec> = {
  typescript: JS_SPEC,
  tsx: JS_SPEC,
  javascript: JS_SPEC,
  python: PY_SPEC,
  go: GO_SPEC,
  rust: RUST_SPEC,
  java: JAVA_SPEC,
  ruby: RUBY_SPEC,
};

function specFor(langId: string): LanguageSpec {
  return SPECS[langId] ?? GENERIC_SPEC;
}

function firstIdentifier(node: Node): string | null {
  const named = node.childForFieldName("name");
  if (named) return named.text;
  for (const c of node.namedChildren) {
    if (IDENTIFIER_TYPES.includes(c.type)) return c.text;
  }
  return null;
}

function stripQuotes(s: string): string {
  return s.replace(/^["'`]|["'`]$/g, "");
}

function firstStringDescendant(node: Node): string | null {
  for (const t of STRING_TYPES) {
    const found = node.descendantsOfType(t);
    if (found.length > 0 && found[0]) return stripQuotes(found[0].text);
  }
  return null;
}

function isExported(node: Node, name: string, style: LanguageSpec["exportStyle"]): boolean {
  switch (style) {
    case "always":
      return !name.startsWith("_");
    case "uppercase":
      return /^[A-Z]/.test(name);
    case "visibility":
      return node.children.some((c) => c.type === "visibility_modifier");
    case "modifier":
      return /(^|\s)public(\s|$)/.test(node.text.slice(0, 80));
    case "js":
      // handled by ancestor unwrap; default false here.
      return false;
  }
}

/** Extract import module strings from the whole tree (imports may be grouped). */
export function extractImports(root: Node, langId: string): ImportRef[] {
  const spec = specFor(langId);
  const out: ImportRef[] = [];

  for (const type of spec.importTypes) {
    for (const node of root.descendantsOfType(type)) {
      const mod = moduleFromImport(node, langId);
      if (mod) out.push({ module: mod, line: node.startPosition.row, resolved: null, external: false });
    }
  }

  // Ruby / dynamic require(...) style: calls to require / require_relative / import.
  if (langId === "ruby" || spec.importTypes.length === 0) {
    for (const call of root.descendantsOfType("call")) {
      const method = call.childForFieldName("method")?.text;
      if (method === "require" || method === "require_relative") {
        const mod = firstStringDescendant(call);
        if (mod) out.push({ module: mod, line: call.startPosition.row, resolved: null, external: false });
      }
    }
  }

  return out;
}

function moduleFromImport(node: Node, langId: string): string | null {
  // JS/TS: source field. Python from-import: module_name field. Others: first string / path.
  const source = node.childForFieldName("source") ?? node.childForFieldName("module_name");
  if (source) return stripQuotes(source.text);
  const str = firstStringDescendant(node);
  if (str) return str;
  // Rust `use a::b::c;` / Java `import a.b.C;` — take the path text.
  if (langId === "rust" || langId === "java") {
    const path = node.namedChildren.find((c) => c.type.includes("identifier") || c.type.includes("path"));
    if (path) return path.text.replace(/;$/, "").trim();
  }
  return null;
}

/** Extract top-level symbols, unwrapping export/decorator/visibility wrappers. */
export function extractSymbols(root: Node, langId: string): SymbolRecord[] {
  const spec = specFor(langId);
  const out: SymbolRecord[] = [];
  for (const child of root.namedChildren) collect(child, spec, out, false);
  return out;
}

function collect(node: Node, spec: LanguageSpec, out: SymbolRecord[], forcedExport: boolean): void {
  // Unwrap JS `export ...` and Python `@decorator def ...`.
  if (node.type === "export_statement") {
    for (const c of node.namedChildren) collect(c, spec, out, true);
    return;
  }
  if (node.type === "decorated_definition") {
    for (const c of node.namedChildren) collect(c, spec, out, forcedExport);
    return;
  }

  // Go-style containers: recurse into *_spec children.
  if (spec.containerTypes?.includes(node.type)) {
    for (const c of node.namedChildren) collect(c, spec, out, forcedExport);
    return;
  }

  // JS/TS variable declarations hold their name inside a variable_declarator,
  // and may declare several names at once.
  if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
    const kind = spec.symbolKinds[node.type] ?? "var";
    for (const decl of node.namedChildren) {
      if (decl.type !== "variable_declarator") continue;
      const name = decl.childForFieldName("name")?.text ?? firstIdentifier(decl);
      if (name) {
        out.push({
          name,
          kind,
          line: node.startPosition.row,
          exported: forcedExport || isExported(node, name, spec.exportStyle),
        });
      }
    }
    return;
  }

  const kind = spec.symbolKinds[node.type];
  if (!kind || kind === "decorated") return;
  const name = firstIdentifier(node);
  if (!name) return;
  out.push({
    name,
    kind,
    line: node.startPosition.row,
    exported: forcedExport || isExported(node, name, spec.exportStyle),
  });
}

// Copies the tree-sitter core runtime + prebuilt grammar .wasm files into ./grammars
// so the server can load them offline at runtime with no native build step.
// Runs on `postinstall`. Idempotent and best-effort: a missing optional grammar
// only reduces the set of first-class languages, it never breaks the install.
import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(root, "..", "grammars");
mkdirSync(outDir, { recursive: true });

function copyIfPresent(src, destName) {
  if (src && existsSync(src)) {
    copyFileSync(src, join(outDir, destName));
    return true;
  }
  return false;
}

// 1) core runtime
let coreCopied = false;
try {
  const wtsDir = dirname(require.resolve("web-tree-sitter/package.json"));
  for (const candidate of ["tree-sitter.wasm", "debug/tree-sitter.wasm"]) {
    if (copyIfPresent(join(wtsDir, candidate), "tree-sitter.wasm")) {
      coreCopied = true;
      break;
    }
  }
} catch {
  /* web-tree-sitter not installed yet */
}

// 2) grammars from tree-sitter-wasms (prebuilt, no native toolchain required)
let grammarCount = 0;
try {
  const pkgDir = dirname(require.resolve("tree-sitter-wasms/package.json"));
  const grammarSrc = join(pkgDir, "out");
  if (existsSync(grammarSrc)) {
    for (const f of readdirSync(grammarSrc)) {
      if (f.endsWith(".wasm")) {
        copyFileSync(join(grammarSrc, f), join(outDir, f));
        grammarCount++;
      }
    }
  }
} catch {
  /* tree-sitter-wasms not installed */
}

console.error(
  `[copy-grammars] core=${coreCopied ? "ok" : "MISSING"} grammars=${grammarCount} -> ${outDir}`,
);
void pathToFileURL; // silence unused in some lint configs

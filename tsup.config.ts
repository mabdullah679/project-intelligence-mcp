import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "server/main": "src/server/main.ts",
    "cli/main": "src/cli/main.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: { entry: { index: "src/index.ts" } },
  // Grammars are shipped as .wasm assets under grammars/, not bundled.
  external: ["web-tree-sitter"],
});

import { z } from "zod";
import { defineTool, ok, RepoInput } from "./types.js";
import { loadConfig } from "../config/config.js";
import { piLayout } from "../store/layout.js";
import { persistScan, relPaths } from "../store/store.js";
import { updateManifest } from "../store/manifest.js";
import { runScan } from "../core/pipeline.js";

/**
 * repo.scan — walk and analyze the repository, then (by default) persist the
 * repository summary, file index, and language stats into derived/.
 */
export const repoScan = defineTool({
  name: "repo_scan",
  title: "Scan repository",
  description:
    "Map the repository: walk files (respecting .gitignore), detect languages, extract top-level symbols and imports via tree-sitter (with a heuristic fallback for unsupported languages), and hash content. Persists repository-summary, file-index, and language-stats into derived/. Returns counts and language stats.",
  input: RepoInput.extend({
    persist: z.boolean().default(true).describe("Write derived artifacts to disk (default true)."),
  }),
  async run({ repoPath, persist }) {
    const config = await loadConfig(repoPath);
    const scan = await runScan(repoPath, config);

    let written: string[] = [];
    if (persist) {
      const layout = piLayout(repoPath, config.dirName);
      written = await persistScan(layout, scan);
      await updateManifest(layout, config.dirName, {
        lastScanHash: scan.scanHash,
        generators: { scan: scan.generator },
        now: new Date().toISOString(),
      });
    }

    const lowConfidence = scan.files.filter((f) => f.confidence === "low").length;
    const warnings =
      lowConfidence > 0
        ? [`${lowConfidence} file(s) analyzed heuristically (no tree-sitter grammar).`]
        : [];

    return ok(
      {
        repoPath,
        fileCount: scan.fileCount,
        totalBytes: scan.totalBytes,
        languages: scan.languages,
        scanHash: scan.scanHash,
        symbolCount: scan.files.reduce((n, f) => n + f.symbols.length, 0),
        written: relPaths(repoPath, written),
      },
      warnings,
    );
  },
});

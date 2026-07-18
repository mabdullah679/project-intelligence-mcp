import type { Config } from "../../config/config.js";
import type { FileRecord, LanguageStat, RepoScan } from "../../domain/schemas.js";
import { GENERATORS } from "../../domain/version.js";
import { aggregateHash } from "../../util/hash.js";
import { timed } from "../../util/logger.js";
import { walkRepository } from "./walk.js";
import { Analyzer } from "../analyze/analyzer.js";
import { resolveGrammarsDir } from "../analyze/grammars.js";

/**
 * Full repository scan: walk the filesystem, analyze each file for symbols and
 * imports, and aggregate into a deterministic RepoScan. Import resolution is NOT
 * done here — that belongs to the dependency-graph builder, which needs the full
 * file set to resolve relative imports against.
 */
export async function scanRepository(repoPath: string, config: Config): Promise<RepoScan> {
  return timed("scan", async () => {
    const rawFiles = await walkRepository(repoPath, config);
    const analyzer = new Analyzer(resolveGrammarsDir(config.analysis.grammarsDir));

    const files: FileRecord[] = [];
    const languages: Record<string, LanguageStat> = {};
    let totalBytes = 0;

    try {
      for (const raw of rawFiles) {
        const analysis = await analyzer.analyze(raw);
        files.push({
          path: raw.path,
          lang: raw.lang,
          ext: raw.ext,
          size: raw.size,
          loc: raw.loc,
          hash: raw.hash,
          isTest: raw.isTest,
          isDoc: raw.isDoc,
          isConfig: raw.isConfig,
          isEntrypoint: raw.isEntrypoint,
          symbols: analysis.symbols,
          imports: analysis.imports,
          confidence: analysis.confidence,
        });

        totalBytes += raw.size;
        const stat = (languages[raw.lang] ??= { files: 0, bytes: 0, loc: 0 });
        stat.files += 1;
        stat.bytes += raw.size;
        stat.loc += raw.loc;
      }
    } finally {
      analyzer.dispose();
    }

    // Deterministic fingerprint of the scanned content (path + content hash).
    const scanHash = aggregateHash(files.map((f) => `${f.path}:${f.hash}`));

    return {
      repoPath,
      fileCount: files.length,
      totalBytes,
      languages,
      files,
      scanHash,
      generator: GENERATORS.scan,
    };
  });
}

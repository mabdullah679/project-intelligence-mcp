import { readdir, readFile, stat, lstat } from "node:fs/promises";
import { join, relative, sep, extname } from "node:path";
import ignore from "ignore";
import type { Ignore } from "ignore";
import { readTextIfExists } from "../../util/fsx.js";
import { shortHash } from "../../util/hash.js";
import { languageForExtension, UNKNOWN_LANGUAGE } from "../../domain/languages.js";
import type { Config } from "../../config/config.js";

/** Directories/patterns always skipped — build output, VCS, deps, and our own dir. */
const DEFAULT_IGNORE = [
  ".git/",
  ".pi/",
  "node_modules/",
  "dist/",
  "build/",
  "out/",
  "coverage/",
  ".next/",
  ".nuxt/",
  "target/",
  "vendor/",
  "__pycache__/",
  ".venv/",
  "venv/",
  ".mypy_cache/",
  ".pytest_cache/",
  ".gradle/",
  ".idea/",
  "*.min.js",
  "*.map",
  "*.lock",
];

const TEST_HINTS = [
  /(^|\/)tests?(\/|$)/i,
  /(^|\/)__tests__(\/|$)/i,
  /(^|\/)spec(\/|$)/i,
  /\.(test|spec)\.[a-z0-9]+$/i,
  /_test\.[a-z0-9]+$/i,
  /(^|\/)test_[^/]+$/i,
];

const DOC_HINTS = [/\.(md|markdown|rst|adoc|txt)$/i, /(^|\/)docs?(\/|$)/i];

const CONFIG_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "go.mod",
  "cargo.toml",
  "pyproject.toml",
  "requirements.txt",
  "pom.xml",
  "build.gradle",
  "gemfile",
  "dockerfile",
  "makefile",
  ".eslintrc",
  "vite.config.ts",
]);

const ENTRYPOINT_HINTS = [
  /(^|\/)main\.[a-z0-9]+$/i,
  /(^|\/)index\.[a-z0-9]+$/i,
  /(^|\/)app\.[a-z0-9]+$/i,
  /(^|\/)cmd\//i,
  /(^|\/)__main__\.py$/i,
];

export interface RawFile {
  /** repo-relative path, posix separators */
  path: string;
  absPath: string;
  ext: string;
  lang: string;
  size: number;
  loc: number;
  hash: string;
  isTest: boolean;
  isDoc: boolean;
  isConfig: boolean;
  isEntrypoint: boolean;
  isBinary: boolean;
  /** File text; null for binary or oversized files (indexed but not parsed). */
  content: string | null;
}

function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

function isBinaryBuffer(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

function classify(relPath: string, base: string) {
  const lower = base.toLowerCase();
  return {
    isTest: TEST_HINTS.some((r) => r.test(relPath)),
    isDoc: DOC_HINTS.some((r) => r.test(relPath)),
    isConfig: CONFIG_FILES.has(lower),
    isEntrypoint: ENTRYPOINT_HINTS.some((r) => r.test(relPath)),
  };
}

async function buildIgnore(repoPath: string, config: Config): Promise<Ignore> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORE);
  const gitignore = await readTextIfExists(join(repoPath, ".gitignore"));
  if (gitignore) ig.add(gitignore);
  if (config.scan.ignore.length) ig.add(config.scan.ignore);
  return ig;
}

/**
 * Recursively walk a repository, producing a deterministic (path-sorted) list of
 * files with metadata and text. Respects .gitignore + defaults + config globs.
 * Never throws on unreadable entries — it logs nothing and skips them, because a
 * single permission error must not fail a whole-repo scan.
 */
export async function walkRepository(repoPath: string, config: Config): Promise<RawFile[]> {
  const ig = await buildIgnore(repoPath, config);
  const results: RawFile[] = [];

  async function recurse(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    // Sort for deterministic traversal order.
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const rel = toPosix(relative(repoPath, abs));
      if (!rel || rel.startsWith("..")) continue;
      if (!config.scan.includeHidden && entry.name.startsWith(".") && entry.name !== ".gitignore") {
        // Skip dotfiles/dirs by default (except the ignore file we already read).
        if (entry.isDirectory()) continue;
      }

      let isDir = entry.isDirectory();
      let isSymlink = entry.isSymbolicLink();
      if (isSymlink) {
        if (!config.scan.followSymlinks) continue;
        try {
          isDir = (await stat(abs)).isDirectory();
        } catch {
          continue;
        }
      }

      const matchPath = isDir ? `${rel}/` : rel;
      if (ig.ignores(matchPath)) continue;

      if (isDir) {
        await recurse(abs);
        continue;
      }
      if (!entry.isFile() && !isSymlink) continue;

      const raw = await readOneFile(repoPath, abs, rel, config);
      if (raw) results.push(raw);
    }
  }

  await recurse(repoPath);
  results.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return results;
}

async function readOneFile(
  repoPath: string,
  abs: string,
  rel: string,
  config: Config,
): Promise<RawFile | null> {
  let size: number;
  try {
    size = (await lstat(abs)).size;
  } catch {
    return null;
  }

  const ext = extname(rel).toLowerCase();
  const lang = languageForExtension(ext)?.id ?? UNKNOWN_LANGUAGE;
  const base = rel.split("/").pop() ?? rel;
  const flags = classify(rel, base);

  let buf: Buffer;
  try {
    buf = await readFile(abs);
  } catch {
    return null;
  }

  const binary = isBinaryBuffer(buf);
  const tooLarge = size > config.scan.maxFileSizeBytes;
  const content = binary || tooLarge ? null : buf.toString("utf8");
  const loc = content === null ? 0 : content.length === 0 ? 0 : content.split("\n").length;
  // Hash the bytes so binary files still get a stable fingerprint.
  const hash = shortHash(buf);

  return {
    path: rel,
    absPath: abs,
    ext,
    lang,
    size,
    loc,
    hash,
    ...flags,
    isBinary: binary,
    content,
  };
}

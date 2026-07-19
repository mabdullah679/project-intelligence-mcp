import { runArgv } from "../../util/exec.js";

export interface DiffEvidence {
  isGitRepo: boolean;
  base: string | null;
  diff: string;
  stats: { files: number; insertions: number; deletions: number };
  warnings: string[];
}

// A conservative git-ref charset. Valid refs (HEAD, HEAD~1, HEAD^, a1b2c3,
// origin/main, v1.2.3) match this; shell metacharacters and leading dashes
// (which git could interpret as options) do not.
const SAFE_REF = /^[A-Za-z0-9._/@^~-]+$/;

/**
 * Capture a git diff as reviewable evidence. `base` defaults to the working-tree
 * diff vs HEAD. SECURITY: this runs git via an explicit argv with NO shell
 * (runArgv), so model-supplied `base`/`paths` are passed as literal arguments and
 * can never be interpreted as commands. `base` is additionally validated against
 * a ref charset and rejected if it looks like an option, and `paths` are placed
 * after a literal `--` so they cannot be mistaken for flags.
 */
export async function captureDiff(
  repoPath: string,
  base?: string,
  paths?: string[],
): Promise<DiffEvidence> {
  const warnings: string[] = [];
  const empty = { files: 0, insertions: 0, deletions: 0 };

  const check = await runArgv("git", ["rev-parse", "--is-inside-work-tree"], repoPath, 10_000);
  if (check.exitCode !== 0 || check.stdout.trim() !== "true") {
    return { isGitRepo: false, base: base ?? null, diff: "", stats: empty, warnings };
  }

  let ref = "HEAD";
  if (base !== undefined) {
    if (SAFE_REF.test(base) && !base.startsWith("-")) {
      ref = base;
    } else {
      warnings.push(`Ignored invalid base ref '${base}'; used HEAD instead.`);
    }
  }

  // Paths are passed after `--` as separate argv entries: literal, never flags.
  const safePaths = (paths ?? []).filter((p) => typeof p === "string" && p.length > 0);
  const pathArgs = safePaths.length ? ["--", ...safePaths] : [];

  const diffRes = await runArgv("git", ["diff", ref, ...pathArgs], repoPath);
  const statRes = await runArgv("git", ["diff", "--numstat", ref, ...pathArgs], repoPath);

  return {
    isGitRepo: true,
    base: ref,
    diff: diffRes.stdout,
    stats: parseNumstat(statRes.stdout),
    warnings,
  };
}

function parseNumstat(numstat: string): DiffEvidence["stats"] {
  let files = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of numstat.split("\n")) {
    const m = /^(\d+|-)\t(\d+|-)\t/.exec(line);
    if (!m) continue;
    files++;
    if (m[1] !== "-") insertions += Number(m[1]);
    if (m[2] !== "-") deletions += Number(m[2]);
  }
  return { files, insertions, deletions };
}

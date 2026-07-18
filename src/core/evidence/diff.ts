import { runCommand } from "../../util/exec.js";

export interface DiffEvidence {
  isGitRepo: boolean;
  base: string | null;
  diff: string;
  stats: { files: number; insertions: number; deletions: number };
}

/**
 * Capture a git diff as reviewable evidence. `base` defaults to the working-tree
 * diff (unstaged + staged vs HEAD). Returns a structured summary plus the raw
 * diff. If the target is not a git repository, returns isGitRepo=false rather
 * than throwing.
 */
export async function captureDiff(
  repoPath: string,
  base?: string,
  paths?: string[],
): Promise<DiffEvidence> {
  const check = await runCommand("git rev-parse --is-inside-work-tree", repoPath, 10_000);
  if (check.exitCode !== 0 || check.stdout.trim() !== "true") {
    return { isGitRepo: false, base: base ?? null, diff: "", stats: { files: 0, insertions: 0, deletions: 0 } };
  }

  const pathArgs = paths && paths.length ? ` -- ${paths.map((p) => `'${p}'`).join(" ")}` : "";
  const range = base ? `${base}` : "HEAD";

  const diffRes = await runCommand(`git diff ${range}${pathArgs}`, repoPath, 30_000);
  const statRes = await runCommand(`git diff --numstat ${range}${pathArgs}`, repoPath, 30_000);

  return {
    isGitRepo: true,
    base: base ?? "HEAD",
    diff: diffRes.stdout,
    stats: parseNumstat(statRes.stdout),
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

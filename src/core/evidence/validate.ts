import type { Config } from "../../config/config.js";
import { runCommand, tailLines } from "../../util/exec.js";

export interface CheckResult {
  name: string;
  command: string;
  exitCode: number | null;
  passed: boolean;
  durationMs: number;
  timedOut: boolean;
  stdoutTail: string;
  stderrTail: string;
}

/**
 * Resolve which validation commands to run. `checks` names a subset (test, lint,
 * build, or a custom key); when omitted, every configured command runs. Commands
 * come exclusively from the repo's `.pi/config.json` — the MCP never invents them.
 */
export function resolveChecks(config: Config, checks?: string[]): Array<{ name: string; command: string }> {
  const available = new Map<string, string>();
  if (config.validation.test) available.set("test", config.validation.test);
  if (config.validation.lint) available.set("lint", config.validation.lint);
  if (config.validation.build) available.set("build", config.validation.build);
  for (const [name, cmd] of Object.entries(config.validation.custom)) available.set(name, cmd);

  const selected = checks && checks.length ? checks : [...available.keys()];
  const out: Array<{ name: string; command: string }> = [];
  for (const name of selected) {
    const command = available.get(name);
    if (command) out.push({ name, command });
  }
  return out;
}

export async function runValidation(
  repoPath: string,
  config: Config,
  checks?: string[],
): Promise<{ results: CheckResult[]; unknown: string[] }> {
  const toRun = resolveChecks(config, checks);
  const known = new Set(toRun.map((c) => c.name));
  const unknown = (checks ?? []).filter((c) => !known.has(c));

  const results: CheckResult[] = [];
  for (const { name, command } of toRun) {
    const r = await runCommand(command, repoPath);
    results.push({
      name,
      command,
      exitCode: r.exitCode,
      passed: r.exitCode === 0 && !r.timedOut,
      durationMs: r.durationMs,
      timedOut: r.timedOut,
      stdoutTail: tailLines(r.stdout),
      stderrTail: tailLines(r.stderr),
    });
  }
  return { results, unknown };
}

import { spawn, type SpawnOptions } from "node:child_process";

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/**
 * Shared capture core. Wires stdout/stderr capture, a kill-on-timeout, and
 * settles a single ExecResult. Never rejects — spawn errors resolve with
 * exitCode=null so callers get a uniform shape.
 */
function capture(
  command: string,
  args: string[],
  options: SpawnOptions,
  timeoutMs: number,
  maxBuffer: number,
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const cap = (chunk: Buffer, sink: "out" | "err") => {
      const text = chunk.toString("utf8");
      if (sink === "out") stdout = clamp(stdout + text, maxBuffer);
      else stderr = clamp(stderr + text, maxBuffer);
    };
    child.stdout?.on("data", (c) => cap(c, "out"));
    child.stderr?.on("data", (c) => cap(c, "err"));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const settle = (exitCode: number | null, errText = ""): void => {
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout,
        stderr: stderr + errText,
        durationMs: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
        timedOut,
      });
    };
    child.on("close", (code) => settle(code));
    child.on("error", (err) => settle(null, `\n[spawn error] ${String(err)}`));
  });
}

/**
 * Run a full shell command string, capturing output. Use ONLY for commands that
 * originate from the repo's own config (validation: test/lint/build). Because it
 * uses a shell, the command string must never be built from model-supplied
 * arguments — for those, use {@link runArgv}.
 */
export function runCommand(
  command: string,
  cwd: string,
  timeoutMs = 120_000,
  maxBuffer = 2_000_000,
): Promise<ExecResult> {
  return capture(command, [], { cwd, shell: true }, timeoutMs, maxBuffer);
}

/**
 * Run a program with an explicit argv and NO shell. Every argument is passed
 * literally to the program — there is no shell parsing, so arguments cannot be
 * interpreted as commands, redirections, or metacharacters. This is the safe way
 * to run git with model-supplied refs/paths (see evidence/diff).
 */
export function runArgv(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 30_000,
  maxBuffer = 2_000_000,
): Promise<ExecResult> {
  return capture(command, args, { cwd, shell: false }, timeoutMs, maxBuffer);
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(s.length - max) : s;
}

/** Keep only the last N lines — enough to see failures without flooding output. */
export function tailLines(text: string, n = 60): string {
  const lines = text.split("\n");
  return lines.length <= n ? text : lines.slice(lines.length - n).join("\n");
}

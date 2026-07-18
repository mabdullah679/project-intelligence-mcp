import { spawn } from "node:child_process";

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/**
 * Run a shell command in a working directory, capturing output. Used for
 * validation (tests/lint/build) and git diff evidence. The MCP only ever runs
 * commands that come from the repo's own config or from git — it never
 * synthesizes commands from model output.
 *
 * `startNs` is injected so duration is measured without the disallowed clock
 * helpers being needed by callers; here we use hrtime which is monotonic and
 * always available.
 */
export function runCommand(
  command: string,
  cwd: string,
  timeoutMs = 120_000,
  maxBuffer = 2_000_000,
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const child = spawn(command, { cwd, shell: true });
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

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code,
        stdout,
        stderr,
        durationMs: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
        timedOut,
      });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        stdout,
        stderr: stderr + `\n[spawn error] ${String(err)}`,
        durationMs: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
        timedOut,
      });
    });
  });
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(s.length - max) : s;
}

/** Keep only the last N lines — enough to see failures without flooding output. */
export function tailLines(text: string, n = 60): string {
  const lines = text.split("\n");
  return lines.length <= n ? text : lines.slice(lines.length - n).join("\n");
}

/**
 * Structured logger that always writes to STDERR. This is mandatory for an MCP
 * stdio server: STDOUT is reserved for the JSON-RPC protocol, so any stray
 * write there corrupts the transport. Keeping all diagnostics on stderr means
 * the same code is safe under the MCP server and the CLI.
 */
type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const env = (process.env.PI_LOG_LEVEL ?? "info").toLowerCase() as Level;
  return ORDER[env] ?? ORDER.info;
}

function emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (ORDER[level] < threshold()) return;
  const line = fields
    ? `[pi:${level}] ${msg} ${safeJson(fields)}`
    : `[pi:${level}] ${msg}`;
  process.stderr.write(line + "\n");
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "[unserializable]";
  }
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};

/** Times an async operation and logs its duration at debug level. */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    log.debug(`${label} done`, { ms: Math.round(ms) });
  }
}

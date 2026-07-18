#!/usr/bin/env node
import { TOOLS, toolByName } from "../tools/registry.js";

/**
 * Offline CLI over the exact same tool registry the MCP server uses. This lets
 * every tool be exercised without an MCP client — essential for testing, the
 * acceptance demo, and debugging. Unlike the server, the CLI may write to stdout.
 *
 * Usage:
 *   pi-cli list
 *   pi-cli <tool> --repo <path> [--task "..."] [--<key> <value>]
 *   pi-cli <tool> --json '{"repoPath":"...", ...}'
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === "list" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const tool = toolByName(command);
  if (!tool) {
    process.stderr.write(`Unknown tool: ${command}\n\n`);
    printHelp();
    process.exit(2);
    return;
  }

  const input = parseArgs(argv.slice(1));
  const parsed = tool.input.safeParse(input);
  if (!parsed.success) {
    process.stderr.write(`Invalid input for ${tool.name}:\n${JSON.stringify(parsed.error.format(), null, 2)}\n`);
    process.exit(2);
    return;
  }

  const result = await tool.run(parsed.data as never);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

/** Short aliases for ergonomics; the canonical key is what the schema expects. */
const ALIASES: Record<string, string> = { repo: "repoPath" };

function parseArgs(args: string[]): Record<string, unknown> {
  let input: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg?.startsWith("--")) continue;
    const rawKey = arg.slice(2);
    const value = args[i + 1];
    i++;
    if (rawKey === "json") {
      input = { ...input, ...JSON.parse(value ?? "{}") };
      continue;
    }
    const key = ALIASES[rawKey] ?? rawKey;
    input[key] = coerce(value ?? "");
  }
  return input;
}

/** Best-effort scalar coercion for CLI convenience; JSON values pass through --json. */
function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value !== "" && !Number.isNaN(Number(value)) && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  try {
    if (value.startsWith("{") || value.startsWith("[")) return JSON.parse(value);
  } catch {
    /* fall through to string */
  }
  return value;
}

function printHelp(): void {
  const lines = ["Project Intelligence MCP — CLI", "", "Tools:"];
  for (const t of TOOLS) lines.push(`  ${t.name.padEnd(22)} ${t.title}`);
  lines.push(
    "",
    "Examples:",
    "  pi-cli intel_init --repo /path/to/repo",
    "  pi-cli repo_scan --repo /path/to/repo",
    '  pi-cli context_compile --repo /path/to/repo --task "add retry to the http client"',
    "",
  );
  process.stdout.write(lines.join("\n") + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${String(err)}\n`);
  process.exit(1);
});

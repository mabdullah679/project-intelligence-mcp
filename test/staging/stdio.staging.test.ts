import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

// Staging gate: drives the BUILT server (dist/server/main.js) over real stdio
// JSON-RPC, exactly as an MCP host would launch it. Run `npm run build` first.
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "..");
const SERVER = join(ROOT, "dist", "server", "main.js");
const SAMPLE = join(ROOT, "test", "fixtures", "sample");

const EXPECTED_TOOLS = [
  "intel_init", "intel_status", "intel_regenerate", "repo_scan", "graph_dependencies",
  "graph_architecture", "discover_components", "context_compile", "validate_run",
  "evidence_diff", "decision_record", "invariant_record", "memory_session_append",
  "sprint_checkpoint",
];

let client: Client;

beforeAll(async () => {
  expect(existsSync(SERVER), "dist/server/main.js missing: run npm run build").toBe(true);
  client = new Client({ name: "staging-test", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER] }));
});
afterAll(async () => {
  await client?.close();
});

describe("built server over stdio", () => {
  it("advertises exactly the registered tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("repo_scan (persist=false) returns real counts for the sample fixture", async () => {
    const res = await client.callTool({ name: "repo_scan", arguments: { repoPath: SAMPLE, persist: false } });
    expect(res.isError).toBeFalsy();
    const out = res.structuredContent as { ok: boolean; fileCount: number; languages: unknown };
    expect(out.ok).toBe(true);
    expect(out.fileCount).toBeGreaterThan(5);
  });

  it("rejects invalid input at the protocol boundary", async () => {
    const res = await client
      .callTool({ name: "repo_scan", arguments: { persist: false } })
      .then((r) => ({ isError: r.isError === true }))
      .catch(() => ({ isError: true }));
    expect(res.isError).toBe(true);
  });
});

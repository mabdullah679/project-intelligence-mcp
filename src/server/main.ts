#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { log } from "../util/logger.js";

/**
 * Entry point for the MCP stdio server. STDOUT carries the JSON-RPC protocol;
 * all logging goes to STDERR (see util/logger). Offline and side-effect-free
 * until a tool is invoked.
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("project-intelligence-mcp ready on stdio");
}

main().catch((err) => {
  log.error("fatal", { error: String(err) });
  process.exit(1);
});

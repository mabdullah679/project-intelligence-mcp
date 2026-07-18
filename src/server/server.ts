import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOOLS } from "../tools/registry.js";
import { log } from "../util/logger.js";

/**
 * Construct the MCP server and register every tool from the shared registry.
 * The Zod input schema of each tool becomes both the advertised JSON-Schema and
 * the runtime validation, so there is exactly one contract per tool.
 */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: "project-intelligence-mcp", version: "0.1.0" },
    {
      instructions:
        "Deterministic engineering assistant for a repository. Use these tools to map the repo, build dependency/architecture graphs, compile bounded task context, validate work, and maintain durable project memory. The server never calls an LLM; it returns evidence and structured data for you to reason over.",
    },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input.shape,
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await tool.run(args as never);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          };
        } catch (err) {
          log.error("tool failed", { tool: tool.name, error: String(err) });
          return {
            isError: true,
            content: [{ type: "text" as const, text: `Error in ${tool.name}: ${String(err)}` }],
          };
        }
      },
    );
  }

  return server;
}

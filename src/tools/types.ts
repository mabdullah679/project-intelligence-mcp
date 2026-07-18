import { z } from "zod";

/**
 * A ToolDef is a transport-agnostic description of one MCP tool. The MCP server
 * and the CLI both consume this same registry, so a tool is defined once and is
 * automatically available over stdio JSON-RPC and on the command line. The Zod
 * `input` schema is the single source of truth for validation AND for the
 * JSON-Schema advertised to MCP clients.
 */
export interface ToolDef<TInput extends z.AnyZodObject = z.AnyZodObject> {
  name: string;
  title: string;
  description: string;
  input: TInput;
  run: (input: z.infer<TInput>) => Promise<Record<string, unknown>>;
}

export function defineTool<TInput extends z.AnyZodObject>(def: ToolDef<TInput>): ToolDef<TInput> {
  return def;
}

/**
 * Type-erased tool for the heterogeneous registry. Each tool's `run` is
 * contravariant in its specific input type, so a list of differently-typed
 * ToolDefs must be stored at this widened type. Validation still happens at the
 * boundary via `input.parse`, so erasing the static input type is safe.
 */
export type AnyTool = ToolDef<z.AnyZodObject> & { run: (input: never) => Promise<Record<string, unknown>> };

/** Standard success envelope fields shared by every tool result. */
export interface Envelope {
  ok: boolean;
  warnings: string[];
}

export function ok(fields: Record<string, unknown>, warnings: string[] = []): Record<string, unknown> {
  return { ok: true, warnings, ...fields };
}

/** Shared input fragment: every tool operates on a repository path. */
export const RepoInput = z.object({
  repoPath: z.string().describe("Absolute path to the target repository."),
});

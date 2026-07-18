/**
 * Public library surface. The MCP is usable as a server (src/server), a CLI
 * (src/cli), or embedded directly via these exports. Everything is deterministic
 * and offline.
 */
export { createServer } from "./server/server.js";
export { TOOLS, toolByName } from "./tools/registry.js";
export type { ToolDef } from "./tools/types.js";

export { loadConfig, defaultConfig, ConfigSchema, type Config } from "./config/config.js";
export { runScan, runAnalysis, type Analysis } from "./core/pipeline.js";
export { scanRepository } from "./core/scan/scan.js";
export { buildDependencyGraph } from "./core/graph/dependencies.js";
export { buildArchitecture } from "./core/graph/architecture.js";
export { compileContext, type CompileInput } from "./core/context/compile.js";
export { scaffold } from "./core/init/scaffold.js";
export { piLayout, type PiLayout } from "./store/layout.js";

export * from "./domain/schemas.js";

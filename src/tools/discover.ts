import { z } from "zod";
import { defineTool, ok, RepoInput } from "./types.js";
import { loadConfig } from "../config/config.js";
import { piLayout } from "../store/layout.js";
import { persistComponentCatalog, relPaths } from "../store/store.js";
import { updateManifest } from "../store/manifest.js";
import { runAnalysis } from "../core/pipeline.js";
import { buildComponentCatalog } from "../core/discover/catalog.js";

/**
 * discover.components — enumerate the human-facing components of a repository:
 * services, modules, tests, docs, entrypoints, and ownership.
 */
export const discoverComponents = defineTool({
  name: "discover_components",
  title: "Discover components",
  description:
    "Discover repository components: services (entrypoints under service dirs / Dockerfiles), modules, test suites, documentation, entrypoints, and ownership (parsed from CODEOWNERS). Persists component-catalog into derived/.",
  input: RepoInput.extend({
    persist: z.boolean().default(true),
  }),
  async run({ repoPath, persist }) {
    const config = await loadConfig(repoPath);
    const { scan, arch } = await runAnalysis(repoPath, config);
    const catalog = await buildComponentCatalog(scan, arch, repoPath);

    let written: string[] = [];
    if (persist) {
      const layout = piLayout(repoPath, config.dirName);
      written = await persistComponentCatalog(layout, catalog);
      await updateManifest(layout, config.dirName, {
        generators: { componentCatalog: catalog.generator },
        now: new Date().toISOString(),
      });
    }

    return ok({
      services: catalog.services,
      moduleCount: catalog.modules.length,
      testCount: catalog.tests.length,
      docCount: catalog.docs.length,
      entrypoints: catalog.entrypoints,
      owners: catalog.owners,
      written: relPaths(repoPath, written),
    });
  },
});

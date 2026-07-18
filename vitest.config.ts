import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/*.test.ts"],
    exclude: ["test/fixtures/**"],
    environment: "node",
    testTimeout: 20000,
    globals: false,
  },
});

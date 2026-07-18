import { describe, it, expect } from "vitest";
import { findCycles } from "../src/core/graph/tarjan.js";
import { stem, tokenizeTask } from "../src/core/context/tokenize.js";
import { canonicalJson } from "../src/util/json.js";
import { moduleIdForPath } from "../src/core/graph/modules.js";

describe("findCycles", () => {
  it("detects a simple 2-cycle and ignores a DAG", () => {
    const cycles = findCycles(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "a"],
        ["b", "c"],
      ],
    );
    expect(cycles).toEqual([["a", "b"]]);
  });

  it("returns no cycles for an acyclic graph", () => {
    const cycles = findCycles(["a", "b", "c"], [
      ["a", "b"],
      ["b", "c"],
    ]);
    expect(cycles).toEqual([]);
  });
});

describe("tokenize/stem", () => {
  it("normalizes plural and verb inflections", () => {
    expect(stem("dependencies")).toBe("dependency");
    expect(stem("imports")).toBe("import");
    expect(stem("resolves")).toBe("resolve");
  });

  it("drops stopwords and short tokens", () => {
    expect(tokenizeTask("fix the import resolver")).toEqual(
      expect.arrayContaining(["import", "resolver"]),
    );
    expect(tokenizeTask("fix the import resolver")).not.toContain("the");
  });
});

describe("canonicalJson", () => {
  it("sorts object keys recursively and is stable", () => {
    const a = canonicalJson({ b: 1, a: { d: 2, c: 3 } });
    const b = canonicalJson({ a: { c: 3, d: 2 }, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n');
  });
});

describe("moduleIdForPath", () => {
  it("uses top-level dir, or boundary-hinted second level, and (root) for root files", () => {
    expect(moduleIdForPath("src/core/x.ts", [])).toBe("src");
    expect(moduleIdForPath("packages/api/src/x.ts", ["packages"])).toBe("packages/api");
    expect(moduleIdForPath("README.md", [])).toBe("(root)");
  });
});

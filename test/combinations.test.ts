import { describe, expect, it } from "vitest";
import { combinations, combine } from "../src";

describe("combinations", () => {
  describe("Cartesian product generation", () => {
    it("generates Cartesian product for a single object with multiple options", () => {
      const cases = combinations({
        browser: ["chromium", "firefox"],
        environment: ["local", "ci"],
      });

      expect(cases).toHaveLength(4);
      expect(cases[0]).toEqual({
        data: { browser: "chromium", environment: "local" },
        name: "chromium - local",
        metadata: {
          tags: ["@browser:chromium", "@environment:local"],
        },
      });
      expect(cases[1]).toEqual({
        data: { browser: "chromium", environment: "ci" },
        name: "chromium - ci",
        metadata: {
          tags: ["@browser:chromium", "@environment:ci"],
        },
      });
      expect(cases[2]).toEqual({
        data: { browser: "firefox", environment: "local" },
        name: "firefox - local",
        metadata: {
          tags: ["@browser:firefox", "@environment:local"],
        },
      });
      expect(cases[3]).toEqual({
        data: { browser: "firefox", environment: "ci" },
        name: "firefox - ci",
        metadata: {
          tags: ["@browser:firefox", "@environment:ci"],
        },
      });
    });

    it("respects custom nameSeparator", () => {
      const cases = combinations(
        {
          os: ["mac", "windows"],
          theme: ["dark", "light"],
        },
        {
          nameSeparator: " | ",
        }
      );

      expect(cases[0]?.name).toBe("mac | dark");
      expect(cases[1]?.name).toBe("mac | light");
      expect(cases[2]?.name).toBe("windows | dark");
      expect(cases[3]?.name).toBe("windows | light");
    });

    it("handles scalar values and single-element arrays", () => {
      const cases = combinations({
        browser: "chromium",
        locale: ["en-US"],
      });

      expect(cases).toHaveLength(1);
      expect(cases[0]).toEqual({
        data: { browser: "chromium", locale: "en-US" },
        name: "chromium - en-US",
        metadata: {
          tags: ["@browser:chromium", "@locale:en-US"],
        },
      });
    });

    it("produces zero combinations when an option has an empty candidate array", () => {
      // Zero candidates for an option means zero combinations for the Cartesian product
      expect(combinations({ browser: [] })).toEqual([]);
      expect(combinations({ browser: ["chromium", "firefox"], env: [] })).toEqual([]);
    });
  });

  describe("Metadata tag generation", () => {
    it("generates nested path tags for nested objects and Cartesian-expands them", () => {
      const cases = combinations({
        user: {
          role: ["admin", "member"],
          active: [true, false],
        },
        mode: ["standard"],
      });

      // 2 roles * 2 active * 1 mode = 4 combinations
      expect(cases).toHaveLength(4);
      expect(cases[0]?.data).toEqual({
        user: { role: "admin", active: true },
        mode: "standard",
      });
      expect(cases[0]?.metadata.tags).toEqual([
        "@user.role:admin",
        "@user.active:true",
        "@mode:standard",
      ]);
      expect(cases[3]?.data).toEqual({
        user: { role: "member", active: false },
        mode: "standard",
      });
      expect(cases[3]?.metadata.tags).toEqual([
        "@user.role:member",
        "@user.active:false",
        "@mode:standard",
      ]);
    });
  });

  describe("combinations.asArray", () => {
    it("generates combinations where data payload is an array", () => {
      const cases = combinations.asArray([
        { browser: ["chromium", "firefox"] },
        { env: ["local", "ci"] },
      ]);

      expect(cases).toHaveLength(4);
      expect(cases[0]?.data).toEqual([
        { browser: "chromium" },
        { env: "local" },
      ]);
      expect(cases[0]?.name).toBe("chromium - local");
      expect(cases[0]?.metadata.tags).toEqual([
        "@0.browser:chromium",
        "@1.env:local",
      ]);

      expect(cases[3]?.data).toEqual([{ browser: "firefox" }, { env: "ci" }]);
      expect(cases[3]?.name).toBe("firefox - ci");
    });

    it("returns empty array for combinations.asArray([]) or when an item has 0 candidates", () => {
      expect(combinations.asArray([])).toEqual([]);
      expect(combinations.asArray([{ browser: ["chromium"] }, { env: [] }])).toEqual([]);
    });
  });

  describe("Candidate objects and combine()", () => {
    it("treats objects inside candidate arrays as discrete values (not recursively Cartesian expanded)", () => {
      const cases = combinations({
        user: [
          { role: "admin" },
          { role: "user" },
        ],
      });

      expect(cases).toHaveLength(2);
      expect(cases[0]?.data).toEqual({ user: { role: "admin" } });
      expect(cases[1]?.data).toEqual({ user: { role: "user" } });
    });

    it("combines independent combination sets without Cartesian multiplication", () => {
      const browsers = combinations({ browser: ["chromium", "firefox"] });
      const envs = combinations({ env: ["local", "ci"] });

      // 2 browser cases + 2 env cases = 4 total cases (concatenated, NOT 2 * 2 = 4 multiplied)
      const allCases = combine(browsers, envs);
      expect(allCases).toHaveLength(4);
      expect(allCases[0]?.data).toEqual({ browser: "chromium" });
      expect(allCases[1]?.data).toEqual({ browser: "firefox" });
      expect(allCases[2]?.data).toEqual({ env: "local" });
      expect(allCases[3]?.data).toEqual({ env: "ci" });
    });

    it("supports combine() with 0, 1, 2, and 3 argument lists", () => {
      expect(combine()).toEqual([]);

      const a = combinations({ a: [1, 2] });
      const b = combinations({ b: [3, 4] });
      const c = combinations({ c: [5] });

      expect(combine(a)).toHaveLength(2);
      expect(combine(a, b)).toHaveLength(4);
      expect(combine(a, b, c)).toHaveLength(5);
    });

    it("ensures combinations and combine do not mutate input objects or arrays", () => {
      const input = {
        browser: ["chromium", "firefox"],
        config: { timeout: [1000, 2000] },
      };
      const copy = JSON.parse(JSON.stringify(input));

      const cases = combinations(input);
      combine(cases, cases);

      expect(input).toEqual(copy);
    });
  });
});

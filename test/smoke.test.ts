import { describe, expect, it } from "vitest";
// @ts-ignore - smoke test importing built artifact
import { resolve as esmResolve, combinations as esmCombinations, combine as esmCombine } from "../dist/index.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { resolve: cjsResolve, combinations: cjsCombinations, combine: cjsCombine } = require("../dist/index.cjs");

describe("Built Artifact Smoke Test (Dual ESM & CJS)", () => {
  const sampleData = {
    teams: [
      {
        name: "Platform",
        lead: { role: "admin" },
        members: [{ name: "John" }, { name: "Shan" }],
      },
      {
        name: "QA",
        lead: { role: "member" },
        members: [{ name: "Charlie" }],
      },
    ],
  };

  const runtimes = [
    {
      name: "ESM",
      resolve: esmResolve,
      combinations: esmCombinations,
      combine: esmCombine,
    },
    {
      name: "CJS",
      resolve: cjsResolve,
      combinations: cjsCombinations,
      combine: cjsCombine,
    },
  ];

  runtimes.forEach(({ name, resolve, combinations, combine }) => {
    it(`verifies full functional semantics with ${name} built artifact`, () => {
      const members = resolve(sampleData).get("teams.members.name").values();
      expect(members).toEqual(["John", "Shan", "Charlie"]);

      // where() filtering
      const adminTeams = resolve(sampleData).get("teams").where("lead.role:admin").values();
      expect(adminTeams).toHaveLength(1);
      expect(adminTeams[0]?.name).toBe("Platform");

      // value(index), first(), last()
      const r = resolve(members);
      expect(r.value()).toBe("John");
      expect(r.value(1)).toBe("Shan");
      expect(r.first()).toBe("John");
      expect(r.last()).toBe("Charlie");

      // equals() and not.equals(), contains() and not.contains()
      expect(resolve([1, 2, 3]).equals(2)).toEqual([2]);
      expect(resolve([1, 2, 3]).not.equals(2)).toEqual([1, 3]);
      expect(resolve("hello world").contains("world")).toEqual(["hello world"]);
      expect(resolve("hello world").not.contains("world")).toEqual([]);
      expect(resolve([123, 456]).contains(123)).toEqual([123]);
      expect(resolve([123, 456]).not.contains(123)).toEqual([456]);
      expect(resolve([123, 456]).contains(23)).toEqual([]);
      expect(resolve([123, 456]).not.contains(23)).toEqual([123, 456]);

      // combinations & combine()
      const browsers = combinations({ browser: ["chromium", "firefox"] });
      const envs = combinations({ env: ["local", "ci"] });
      const combined = combine(browsers, envs);
      expect(combined).toHaveLength(4);
      expect(combined[0]?.data).toEqual({ browser: "chromium" });
      expect(combined[2]?.data).toEqual({ env: "local" });
    });
  });
});

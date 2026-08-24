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

  it("verifies full functional semantics with ESM built artifact", () => {
    const members = esmResolve(sampleData).get("teams.members.name").values();
    expect(members).toEqual(["John", "Shan", "Charlie"]);

    // where() filtering
    const adminTeams = esmResolve(sampleData).get("teams").where("lead.role:admin").values();
    expect(adminTeams).toHaveLength(1);
    expect(adminTeams[0]?.name).toBe("Platform");

    // value(index), first(), last()
    const r = esmResolve(members);
    expect(r.value()).toBe("John");
    expect(r.value(1)).toBe("Shan");
    expect(r.first()).toBe("John");
    expect(r.last()).toBe("Charlie");

    // equals() and not.equals(), contains() and not.contains()
    expect(esmResolve([1, 2, 3]).equals(2)).toEqual([2]);
    expect(esmResolve([1, 2, 3]).not.equals(2)).toEqual([1, 3]);
    expect(esmResolve("hello world").contains("world")).toEqual(["hello world"]);
    expect(esmResolve("hello world").not.contains("world")).toEqual([]);
    expect(esmResolve([123, 456]).contains(123)).toEqual([123]);
    expect(esmResolve([123, 456]).not.contains(123)).toEqual([456]);
    expect(esmResolve([123, 456]).contains(23)).toEqual([]);
    expect(esmResolve([123, 456]).not.contains(23)).toEqual([123, 456]);

    // combinations & combine()
    const browsers = esmCombinations({ browser: ["chromium", "firefox"] });
    const envs = esmCombinations({ env: ["local", "ci"] });
    const combined = esmCombine(browsers, envs);
    expect(combined).toHaveLength(4);
    expect(combined[0]?.data).toEqual({ browser: "chromium" });
    expect(combined[2]?.data).toEqual({ env: "local" });
  });

  it("verifies full functional semantics with CJS built artifact", () => {
    const members = cjsResolve(sampleData).get("teams.members.name").values();
    expect(members).toEqual(["John", "Shan", "Charlie"]);

    // where() filtering
    const adminTeams = cjsResolve(sampleData).get("teams").where("lead.role:admin").values();
    expect(adminTeams).toHaveLength(1);
    expect(adminTeams[0]?.name).toBe("Platform");

    // value(index), first(), last()
    const r = cjsResolve(members);
    expect(r.value()).toBe("John");
    expect(r.value(1)).toBe("Shan");
    expect(r.first()).toBe("John");
    expect(r.last()).toBe("Charlie");

    // equals() and not.equals(), contains() and not.contains()
    expect(cjsResolve([1, 2, 3]).equals(2)).toEqual([2]);
    expect(cjsResolve([1, 2, 3]).not.equals(2)).toEqual([1, 3]);
    expect(cjsResolve("hello world").contains("world")).toEqual(["hello world"]);
    expect(cjsResolve("hello world").not.contains("world")).toEqual([]);
    expect(cjsResolve([123, 456]).contains(123)).toEqual([123]);
    expect(cjsResolve([123, 456]).not.contains(123)).toEqual([456]);
    expect(cjsResolve([123, 456]).contains(23)).toEqual([]);
    expect(cjsResolve([123, 456]).not.contains(23)).toEqual([123, 456]);

    // combinations & combine()
    const browsers = cjsCombinations({ browser: ["chromium", "firefox"] });
    const envs = cjsCombinations({ env: ["local", "ci"] });
    const combined = cjsCombine(browsers, envs);
    expect(combined).toHaveLength(4);
    expect(combined[0]?.data).toEqual({ browser: "chromium" });
    expect(combined[2]?.data).toEqual({ env: "local" });
  });
});

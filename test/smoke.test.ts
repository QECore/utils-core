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
        members: [{ name: "John" }, { name: "Shan" }],
      },
    ],
  };

  it("works seamlessly with ESM built artifact", () => {
    const members = esmResolve(sampleData).get("teams.members.name").values();
    expect(members).toEqual(["John", "Shan"]);

    const cases = esmCombinations({
      env: ["staging", "prod"],
    });
    expect(cases).toHaveLength(2);
    expect(cases[0]?.name).toBe("staging");

    const combined = esmCombine(cases, cases);
    expect(combined).toHaveLength(4);
  });

  it("works seamlessly with CJS built artifact", () => {
    const members = cjsResolve(sampleData).get("teams.members.name").values();
    expect(members).toEqual(["John", "Shan"]);

    const cases = cjsCombinations({
      env: ["staging", "prod"],
    });
    expect(cases).toHaveLength(2);
    expect(cases[0]?.name).toBe("staging");

    const combined = cjsCombine(cases, cases);
    expect(combined).toHaveLength(4);
  });
});

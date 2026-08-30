import { beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import type { resolve as resolveFn, combinations as combinationsFn, concat as concatFn } from "../src";
import { crm } from "./data";

type ModuleExports = {
  resolve: typeof resolveFn;
  combinations: typeof combinationsFn;
  concat: typeof concatFn;
};

describe("Built Artifact Smoke Test (Dual ESM & CJS)", () => {
  let esmModule: ModuleExports;
  let cjsModule: ModuleExports;

  beforeAll(async () => {
    const esmPath = "../dist/index.js";
    esmModule = (await import(/* @vite-ignore */ esmPath)) as unknown as ModuleExports;
    const require = createRequire(import.meta.url);
    cjsModule = require("../dist/index.cjs") as ModuleExports;
  });

  const runSmokeSuite = (getModule: () => ModuleExports, name: string) => {
    it(`verifies full functional semantics with ${name} built artifact using CRM dataset`, () => {
      const { resolve, combinations, concat } = getModule();

      // get() property extraction
      const userNames = resolve(crm).get("users.name");
      expect(userNames).toEqual(["Shan", "John", "Teja", "Anem"]);

      // filter() narrowing
      const activeProjects = resolve(crm.projects).filter("status=active").get("name");
      expect(activeProjects).toEqual(["CRM"]);

      // at(index) cardinality shift and negative index
      const dev = resolve(crm.users).filter("role=Developer").at(0).get("name");
      expect(dev).toBe("Shan");
      const designer = resolve(crm.users).filter("role=Designer").at(-1).get("name");
      expect(designer).toBe("John");

      // terminal operations
      expect(resolve(crm.users).count()).toBe(4);
      expect(resolve(crm.users).some("role=Developer")).toBe(true);
      expect(resolve(crm.users).every("role=Developer")).toBe(false);
      expect(resolve(crm.users).none("role=Manager")).toBe(true);
      expect(resolve(crm.users).index("role=QA")).toBe(2);
      expect(resolve(crm.users).first()?.name).toBe("Shan");
      expect(resolve(crm.users).last()?.name).toBe("Anem");

      // groupBy()
      const grouped = resolve(crm.users).groupBy("role");
      expect(grouped.Developer).toHaveLength(1);
      expect(grouped.Designer).toHaveLength(1);
      expect(grouped.QA).toHaveLength(2);

      // combinations & concat()
      const browsers = combinations({ browser: ["chromium", "firefox"] });
      const envs = combinations({ env: ["local", "ci"] });
      const concatenated = concat(browsers, envs);
      expect(concatenated).toHaveLength(4);
      expect(concatenated[0]?.data).toEqual({ browser: "chromium" });
      expect(concatenated[2]?.data).toEqual({ env: "local" });
    });
  };

  runSmokeSuite(() => esmModule, "ESM");
  runSmokeSuite(() => cjsModule, "CJS");
});

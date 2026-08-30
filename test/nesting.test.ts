import { describe, expect, expectTypeOf, it } from "vitest";
import { resolve } from "../src";
import { crm, type User, type Team, type Project } from "./data";

describe("Complex Nesting Tests (CRM Dataset)", () => {
  describe("Deep Multi-level Array and Object Traversal", () => {
    it("extracts deeply nested properties across projects.manager.name", () => {
      const names = resolve(crm).get("projects.manager.name");
      expect(names).toEqual(["Shan", "John"]);
      expectTypeOf(names).toEqualTypeOf<string[]>();
    });

    it("extracts deeply nested properties across projects.manager.email", () => {
      const emails = resolve(crm).get("projects.manager.email");
      expect(emails).toEqual(["shan@company.com", "john@company.com"]);
      expectTypeOf(emails).toEqualTypeOf<string[]>();
    });

    it("flattens multi-level array-valued properties across teams.members", () => {
      const allMembers = resolve(crm).get("teams.members");
      expect(allMembers).toEqual(["U001", "U002"]);
      expectTypeOf(allMembers).toEqualTypeOf<string[]>();
    });

    it("filters through multi-level intermediate arrays on crm", () => {
      const activeProjects = resolve(crm.projects)
        .filter("status=active")
        .get("manager.name");
      expect(activeProjects).toEqual(["Shan"]);
    });

    it("groups through deeply nested property paths on crm", () => {
      const grouped = resolve(crm).groupBy("projects.manager.name");
      expect(grouped).toEqual({
        Shan: [crm.projects[0]],
        John: [crm.projects[1]],
      });
    });
  });

  describe("Explicit Indexing into Nested CRM Properties", () => {
    it("indexes into specific project manager properties", () => {
      expect(resolve(crm.projects).at(0).get("manager.name")).toBe("Shan");
      expect(resolve(crm.projects).at(1).get("manager.name")).toBe("John");
      expect(resolve(crm.projects).at(99).get("manager.name")).toBeUndefined();
    });
  });

  describe("Union Types and Mixed-Cardinality Traversal", () => {
    type MixedCRMCardinality =
      | { app: { user: User } }
      | { app: { user: User[] } };

    it("distributes over mixed scalar / array union paths", () => {
      const single: MixedCRMCardinality = { app: { user: crm.users[0]! } };
      const multi: MixedCRMCardinality = { app: { user: crm.users } };

      expect(resolve(single).get("app.user.name")).toEqual("Shan");
      expect(resolve(multi).get("app.user.name")).toEqual([
        "Shan",
        "John",
        "Teja",
        "Anem",
      ]);

      const unionItem = {} as unknown as MixedCRMCardinality;
      expectTypeOf(resolve(unionItem).get("app.user.name")).toEqualTypeOf<
        string | string[]
      >();
    });

    it("handles unions with optional and nullable branches", () => {
      type OptionalCRMBranch = {
        meta?: {
          owner?: {
            name: string;
          } | null;
        };
      };

      const empty: OptionalCRMBranch = {};
      const present: OptionalCRMBranch = {
        meta: { owner: { name: "Shan" } },
      };
      const nullable: OptionalCRMBranch = {
        meta: { owner: null },
      };

      expect(resolve(empty).get("meta.owner.name")).toBeUndefined();
      expect(resolve(present).get("meta.owner.name")).toBe("Shan");
      expect(resolve(nullable).get("meta.owner.name")).toBeUndefined();

      expectTypeOf(
        resolve(present).get("meta.owner.name")
      ).toEqualTypeOf<string | undefined>();
    });
  });
});

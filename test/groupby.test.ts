import { describe, expect, expectTypeOf, it } from "vitest";
import { resolve } from "../src";
import { crm, type User, type Team, type Project } from "./data";

describe("GroupBy Tests (CRM Dataset)", () => {
  describe("Runtime GroupBy Semantics", () => {
    it("groups users by role", () => {
      const grouped = resolve(crm.users).groupBy("role");
      expect(grouped).toEqual({
        Developer: [crm.users[0]],
        Designer: [crm.users[1]],
        QA: [crm.users[2], crm.users[3]],
      });
    });

    it("groups projects by status", () => {
      const grouped = resolve(crm.projects).groupBy("status");
      expect(grouped).toEqual({
        active: [crm.projects[0]],
        completed: [crm.projects[1]],
      });
    });

    it("groups projects by nested manager.name property", () => {
      const grouped = resolve(crm.projects).groupBy("manager.name");
      expect(grouped).toEqual({
        Shan: [crm.projects[0]],
        John: [crm.projects[1]],
      });
    });

    it("groups through intermediate array traversal (crm -> teams.lead)", () => {
      const grouped = resolve(crm).groupBy("teams.lead");
      expect(grouped).toEqual({
        Shan: [crm.teams[0]],
        John: [crm.teams[1]],
      });
    });

    it("grouping by an array-valued property spreads elements into groups (crm -> teams.members)", () => {
      const grouped = resolve(crm).groupBy("teams.members");
      expect(grouped).toEqual({
        U001: [crm.teams[0]],
        U002: [crm.teams[1]],
      });
    });

    it("groups through deep nested property (crm -> projects.manager.email)", () => {
      const grouped = resolve(crm).groupBy("projects.manager.email");
      expect(grouped).toEqual({
        "shan@company.com": [crm.projects[0]],
        "john@company.com": [crm.projects[1]],
      });
    });

    it("empty collection returns empty object", () => {
      expect(resolve([] as User[]).groupBy("role")).toEqual({});
    });

    it("groupBy places null grouping values under the 'null' key", () => {
      const data = [
        { name: "John", badge: null },
        { name: "Shan", badge: "gold" },
      ];
      const grouped = resolve(data).groupBy("badge");
      expect(grouped["null"]).toEqual([{ name: "John", badge: null }]);
      expect(grouped["gold"]).toEqual([{ name: "Shan", badge: "gold" }]);
    });
  });

  describe("groupBy nullish behavior", () => {
    it("missing path groups under 'undefined'", () => {
      const g = resolve([{ id: 1 }, { id: 2 }] as { id: number; tag?: string }[]).groupBy("tag");
      expect(g["undefined"]).toHaveLength(2);
    });

    it("explicit undefined groups under 'undefined'", () => {
      const g = resolve([{ id: 1, tag: undefined }]).groupBy("tag");
      expect(g["undefined"]).toHaveLength(1);
    });

    it("null groups under 'null'", () => {
      const g = resolve([{ id: 1, tag: null }] as { id: number; tag: string | null }[]).groupBy("tag");
      expect(g["null"]).toHaveLength(1);
    });
  });

  describe("Compile-time Type Inferences", () => {
    it("infers strongly typed record buckets for literal union paths", () => {
      const roleGrouped = resolve(crm.users).groupBy("role");
      expectTypeOf(roleGrouped).toEqualTypeOf<
        Partial<Record<"Developer" | "Designer" | "QA", User[]>>
      >();

      const statusGrouped = resolve(crm.projects).groupBy("status");
      expectTypeOf(statusGrouped).toEqualTypeOf<
        Partial<Record<"active" | "completed", Project[]>>
      >();
    });

    it("infers Record<string, Team[]> for intermediate array paths", () => {
      const leadGrouped = resolve(crm).groupBy("teams.lead");
      expectTypeOf(leadGrouped).toEqualTypeOf<Record<string, Team[]>>();

      const membersGrouped = resolve(crm).groupBy("teams.members");
      expectTypeOf(membersGrouped).toEqualTypeOf<Record<string, Team[]>>();
    });

    it("rejects invalid paths at compile time", () => {
      // @ts-expect-error invalid path on users
      resolve(crm.users).groupBy("invalid");

      // @ts-expect-error invalid nested path on crm
      resolve(crm).groupBy("teams.invalid");
    });
  });
});

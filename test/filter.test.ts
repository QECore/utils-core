import { describe, expect, expectTypeOf, it } from "vitest";
import { resolve } from "../src";
import { crm, type User, type Team, type Project } from "./data";

describe("Filter Tests (CRM Dataset)", () => {
  describe("String Matcher DSL Runtime Semantics", () => {
    it("evaluates operator = (Equal)", () => {
      expect(resolve(crm.users).filter("role=Developer").get("name")).toEqual([
        "Shan",
      ]);
      expect(resolve(crm.projects).filter("status=active").get("name")).toEqual([
        "CRM",
      ]);
    });

    it("evaluates operator != (Not equal)", () => {
      expect(resolve(crm.users).filter("role!=Developer").get("name")).toEqual([
        "John",
        "Teja",
        "Anem",
      ]);
    });

    it("evaluates operator ~ (Contains) and !~ (Does not contain)", () => {
      expect(resolve(crm.users).filter("name~an").get("name")).toEqual(["Shan"]);
      expect(resolve(crm.users).filter("name!~an").get("name")).toEqual(["John", "Teja", "Anem"]);
    });

    it("evaluates operator ^ (Starts with) and $ (Ends with)", () => {
      expect(resolve(crm.users).filter("name^Sh").get("name")).toEqual(["Shan"]);
      expect(resolve(crm.users).filter("name$hn").get("name")).toEqual(["John"]);
    });

    it("filters nested manager.name property", () => {
      expect(
        resolve(crm.projects).filter("manager.name=Shan").get("name")
      ).toEqual(["CRM"]);
      expect(
        resolve(crm.projects).filter("manager.email=john@company.com").get("name")
      ).toEqual(["Website"]);
    });

    it("filters through intermediate array on root crm object", () => {
      expect(
        resolve(crm).filter("projects.manager.name=Shan").get("projects.name")
      ).toEqual(["CRM", "Website"]);
    });
  });

  describe("Predicate Overload filter(path, predicate) Runtime Semantics", () => {
    it("intermediate array traversal on literal union property (crm -> users.role)", () => {
      const filtered = resolve(crm).filter(
        "users.role",
        (role) => role === "Developer"
      );

      expect([...filtered]).toEqual([crm.users[0]]);
      expect(filtered.first()).toEqual(crm.users[0]);
      expect(filtered.get("name")).toEqual(["Shan"]);
    });

    it("intermediate array traversal on nested object property (crm -> projects.manager.name)", () => {
      const filtered = resolve(crm).filter(
        "projects.manager.name",
        (name) => name === "John"
      );

      expect([...filtered]).toEqual([crm.projects[1]]);
      expect(filtered.first()).toEqual(crm.projects[1]);
      expect(filtered.get("name")).toEqual(["Website"]);
      expect(filtered.get("manager.email")).toEqual(["john@company.com"]);
    });

    it("intermediate array traversal on array-valued property (crm -> teams.members)", () => {
      const filtered = resolve(crm).filter(
        "teams.members",
        (memberId) => memberId === "U001"
      );

      expect([...filtered]).toEqual([crm.teams[0]]);
      expect(filtered.first()).toEqual(crm.teams[0]);
      expect(filtered.get("name")).toEqual(["Engineering"]);
    });

    it("object-valued path predicate (crm -> projects.manager)", () => {
      const filtered = resolve(crm).filter(
        "projects.manager",
        (manager) => manager.name === "Shan"
      );

      expect([...filtered]).toEqual([crm.projects[0]]);
      expect(filtered.get("name")).toEqual(["CRM"]);
    });

    it("collection of root objects with nested property predicate", () => {
      const filtered = resolve(crm.projects).filter(
        "manager.name",
        (name) => name === "Shan"
      );

      expect([...filtered]).toEqual([crm.projects[0]]);
      expect(filtered.get("name")).toEqual(["CRM"]);
    });

    it("Chainability: supports chained predicate filters", () => {
      const filtered = resolve(crm)
        .filter("projects.status", (status) => status === "active")
        .filter("manager.name", (name) => name === "Shan");

      expect([...filtered]).toEqual([crm.projects[0]]);
      expect(filtered.get("name")).toEqual(["CRM"]);
    });

    it("Empty results when predicate does not match", () => {
      const filtered = resolve(crm).filter(
        "users.name",
        (name) => name === "Nonexistent"
      );

      expect([...filtered]).toEqual([]);
      expect(filtered.get("name")).toEqual([]);
    });
  });

  describe("Compile-time Type Safety & IntelliSense Tests", () => {
    it("string matcher DSL validates paths and operators", () => {
      resolve(crm.users).filter("role=Developer");
      resolve(crm.projects).filter("status=active");
      resolve(crm.projects).filter("manager.name=Shan");
      resolve(crm).filter("users.role=Developer");

      // @ts-expect-error invalid path
      resolve(crm.users).filter("invalid=123");

      // @ts-expect-error invalid operator ==
      resolve(crm.users).filter("role==Developer");

      // @ts-expect-error invalid operator ===
      resolve(crm.users).filter("role===Developer");
    });

    it("predicate overload validates parameter types and return types", () => {
      // 1. Literal union parameter preservation
      const roleFiltered = resolve(crm).filter(
        "users.role",
        (role) => {
          expectTypeOf(role).toEqualTypeOf<"Developer" | "Designer" | "QA">();
          return role === "Developer";
        }
      );
      expectTypeOf(roleFiltered.get("name")).toEqualTypeOf<string[]>();

      // 2. Nested property parameter type
      const managerFiltered = resolve(crm.projects).filter(
        "manager.name",
        (name) => {
          expectTypeOf(name).toEqualTypeOf<string>();
          return name === "Shan";
        }
      );
      expectTypeOf(managerFiltered.get("name")).toEqualTypeOf<string[]>();

      // 3. Array element parameter type
      const membersFiltered = resolve(crm).filter(
        "teams.members",
        (memberId) => {
          expectTypeOf(memberId).toEqualTypeOf<string>();
          return memberId === "U001";
        }
      );
      expectTypeOf(membersFiltered.get("name")).toEqualTypeOf<string[]>();

      // 4. Object-valued path parameter type
      const managerObjFiltered = resolve(crm.projects).filter(
        "manager",
        (manager) => {
          expectTypeOf(manager).toEqualTypeOf<{ name: string; email: string }>();
          return manager.name === "Shan";
        }
      );
      expectTypeOf(managerObjFiltered.get("name")).toEqualTypeOf<string[]>();

      // 5. Negative compile-time tests
      // @ts-expect-error invalid path
      resolve(crm).filter("invalid", (val) => true);

      // @ts-expect-error invalid property access on predicate parameter
      resolve(crm).filter("users", (user) => user.doesNotExist);

      // @ts-expect-error invalid literal comparison
      resolve(crm).filter("users.role", (role) => role === 123);
    });
  });
});

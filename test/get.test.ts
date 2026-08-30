import { describe, expect, expectTypeOf, it } from "vitest";
import { resolve } from "../src";
import { crm, type User, type Team, type Project } from "./data";

describe("Get & Terminal Operations Tests (CRM Dataset)", () => {
  describe("get() Property Extraction", () => {
    it("returns scalar value for single object resolver", () => {
      expect(resolve(crm.users[0]!).get("name")).toBe("Shan");
      expect(resolve(crm.users[0]!).get("email")).toBe("shan@company.com");
      expect(resolve(crm.projects[0]!).get("manager.name")).toBe("Shan");

      expectTypeOf(resolve(crm.users[0]!).get("name")).toEqualTypeOf<string>();
      expectTypeOf(resolve(crm.projects[0]!).get("manager.name")).toEqualTypeOf<string>();
    });

    it("returns array of values for collection resolver", () => {
      expect(resolve(crm.users).get("name")).toEqual([
        "Shan",
        "John",
        "Teja",
        "Anem",
      ]);
      expectTypeOf(resolve(crm.users).get("name")).toEqualTypeOf<string[]>();
    });

    it("flattens array-valued properties in get() (teams.members)", () => {
      expect(resolve(crm.teams).get("members")).toEqual(["U001", "U002"]);
      expectTypeOf(resolve(crm.teams).get("members")).toEqualTypeOf<string[]>();
    });

    it("extracts nested properties across collections (projects.manager.name)", () => {
      expect(resolve(crm.projects).get("manager.name")).toEqual([
        "Shan",
        "John",
      ]);
      expectTypeOf(
        resolve(crm.projects).get("manager.name")
      ).toEqualTypeOf<string[]>();
    });
  });

  describe("at() Indexing & Cardinality Shifts", () => {
    it("selects item by positive zero-based index", () => {
      expect(resolve(crm.users).at(0).get("name")).toBe("Shan");
      expect(resolve(crm.users).at(1).get("name")).toBe("John");

      expectTypeOf(resolve(crm.users).at(0).get("name")).toEqualTypeOf<
        string | undefined
      >();
    });

    it("selects item by negative index", () => {
      expect(resolve(crm.users).at(-1).get("name")).toBe("Anem");
      expect(resolve(crm.users).at(-2).get("name")).toBe("Teja");
    });

    it("returns undefined for out-of-range index", () => {
      expect(resolve(crm.users).at(10).get("name")).toBeUndefined();
      expect(resolve(crm.users).at(-10).get("name")).toBeUndefined();
    });
  });

  describe("Aggregation & Inspection Operations", () => {
    it("count() returns total item count", () => {
      expect(resolve(crm.users).count()).toBe(4);
      expect(resolve(crm.projects).count()).toBe(2);
      expect(resolve([]).count()).toBe(0);
    });

    it("unique() deduplicates extracted values", () => {
      expect(resolve(crm.users).unique("role")).toEqual([
        "Developer",
        "Designer",
        "QA",
      ]);
    });

    it("first() and last() return boundary elements", () => {
      expect(resolve(crm.users).first()?.name).toBe("Shan");
      expect(resolve(crm.users).last()?.name).toBe("Anem");
      expect(resolve([]).first()).toBeUndefined();
      expect(resolve([]).last()).toBeUndefined();
    });

    it("exists() and hasValue() check property presence and non-empty values", () => {
      expect(resolve(crm.users[0]!).exists("name")).toBe(true);
      expect(resolve(crm.projects[0]!).exists("manager.name")).toBe(true);
      expect(resolve(crm.users[0]!).hasValue("name")).toBe(true);
      expect(resolve(crm.users[0]!).hasValue("email")).toBe(true);
    });
  });

  describe("some() Predicate and String Matcher", () => {
    it("some(matcher) evaluates string matchers", () => {
      expect(resolve(crm.users).some("role=Developer")).toBe(true);
      expect(resolve(crm.users).some("role=Nonexistent")).toBe(false);
    });

    it("some(path, predicate) evaluates path predicates", () => {
      expect(
        resolve(crm.users).some("role", (role) => role === "Developer")
      ).toBe(true);

      expect(
        resolve(crm.teams).some("members", (m) => m === "U001")
      ).toBe(true);

      expect(
        resolve(crm.projects).some("manager.name", (name) => name === "Shan")
      ).toBe(true);

      expect(
        resolve(crm).some("users.role", (role) => role === "QA")
      ).toBe(true);
      expect(
        resolve(crm).some("projects.manager.email", (email) => email === "john@company.com")
      ).toBe(true);

      expect(
        resolve(crm.users).some("name", (name) => name === "Nonexistent")
      ).toBe(false);
    });
  });

  describe("none() Predicate and String Matcher", () => {
    it("none(matcher) evaluates string matchers", () => {
      expect(resolve(crm.users).none("role=Manager")).toBe(true);
      expect(resolve(crm.users).none("role=Developer")).toBe(false);
    });

    it("none(path, predicate) evaluates path predicates", () => {
      expect(
        resolve(crm.users).none("name", (name) => name === "Ghost")
      ).toBe(true);
      expect(
        resolve(crm.users).none("role", (role) => role === "Developer")
      ).toBe(false);
      expect(
        resolve(crm).none("projects.manager.name", (name) => name === "Ghost")
      ).toBe(true);
      expect(
        resolve(crm).none("projects.manager.name", (name) => name === "Shan")
      ).toBe(false);
    });
  });

  describe("every() Predicate and String Matcher", () => {
    it("every(matcher) evaluates string matchers", () => {
      expect(resolve(crm.users).every("role=Developer")).toBe(false);
      expect(resolve([] as User[]).every("role=Developer")).toBe(true);
    });

    it("every(path, predicate) evaluates path predicates", () => {
      expect(
        resolve(crm.users).every("role", (role) => role === "Developer")
      ).toBe(false);
      expect(
        resolve(crm.users).every("email", (email) => email.endsWith("@company.com"))
      ).toBe(true);
      expect(
        resolve([] as User[]).every("role", (role) => role === "Developer")
      ).toBe(true);
    });
  });

  describe("index() Predicate and String Matcher", () => {
    it("index(matcher) returns zero-based index or -1", () => {
      expect(resolve(crm.users).index("role=Developer")).toBe(0);
      expect(resolve(crm.users).index("role=Designer")).toBe(1);
      expect(resolve(crm.users).index("role=QA")).toBe(2);
      expect(resolve(crm.users).index("role=Nonexistent")).toBe(-1);
    });

    it("index(path, predicate) returns index of first matching source item", () => {
      expect(
        resolve(crm.users).index("role", (role) => role === "Developer")
      ).toBe(0);
      expect(
        resolve(crm.users).index("role", (role) => role === "Designer")
      ).toBe(1);
      expect(
        resolve(crm.users).index("role", (role) => role === "QA")
      ).toBe(2);

      expect(
        resolve(crm.projects).index("manager.name", (name) => name === "John")
      ).toBe(1);

      expect(
        resolve(crm.teams).index("members", (m) => m === "U002")
      ).toBe(1);

      expect(
        resolve(crm.users).index("name", (name) => name === "Nonexistent")
      ).toBe(-1);
    });
  });

  describe("Compile-time Type Inferences for some / none / every / index", () => {
    it("preserves exact literal union parameter types across all methods", () => {
      resolve(crm.users).some("role", (role) => {
        expectTypeOf(role).toEqualTypeOf<"Developer" | "Designer" | "QA">();
        if (role === "Developer") return true;
        if (role === "Designer") return true;
        expectTypeOf(role).toEqualTypeOf<"QA">();
        return false;
      });

      resolve(crm.users).none("role", (role) => {
        expectTypeOf(role).toEqualTypeOf<"Developer" | "Designer" | "QA">();
        return role === "Developer";
      });

      resolve(crm.users).every("role", (role) => {
        expectTypeOf(role).toEqualTypeOf<"Developer" | "Designer" | "QA">();
        return role === "Developer";
      });

      resolve(crm.users).index("role", (role) => {
        expectTypeOf(role).toEqualTypeOf<"Developer" | "Designer" | "QA">();
        return role === "Developer";
      });
    });

    it("infers array-element types for array-valued properties", () => {
      resolve(crm.teams).some("members", (m) => {
        expectTypeOf(m).toEqualTypeOf<string>();
        return m === "U001";
      });

      resolve(crm.teams).index("members", (m) => {
        expectTypeOf(m).toEqualTypeOf<string>();
        return m === "U001";
      });
    });

    it("infers return types", () => {
      expectTypeOf(
        resolve(crm.users).some("role", (r) => true)
      ).toEqualTypeOf<boolean>();
      expectTypeOf(
        resolve(crm.users).none("role", (r) => true)
      ).toEqualTypeOf<boolean>();
      expectTypeOf(
        resolve(crm.users).every("role", (r) => true)
      ).toEqualTypeOf<boolean>();
      expectTypeOf(
        resolve(crm.users).index("role", (r) => true)
      ).toEqualTypeOf<number>();
    });

    it("rejects invalid paths at compile time", () => {
      // @ts-expect-error invalid path
      resolve(crm.users).some("invalid", (val) => true);

      // @ts-expect-error invalid nested path
      resolve(crm.projects).none("manager.invalid", (val) => true);

      // @ts-expect-error invalid property access
      resolve(crm.projects).every("manager", (mgr) => mgr.invalid);

      // @ts-expect-error invalid literal comparison
      resolve(crm.users).index("role", (role) => role === 123);
    });
  });
});

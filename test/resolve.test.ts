import { describe, expect, it } from "vitest";
import { resolve } from "../src";

describe("resolve", () => {
  describe("Primitive values and basic objects", () => {
    it("resolves primitive values", () => {
      expect(resolve(42).values()).toEqual([42]);
      expect(resolve(42).value()).toBe(42);
      expect(resolve(42).count()).toBe(1);
      expect(resolve(42).exists()).toBe(true);

      expect(resolve("hello").values()).toEqual(["hello"]);
      expect(resolve("hello").value()).toBe("hello");

      expect(resolve(true).values()).toEqual([true]);
      expect(resolve(true).value()).toBe(true);
    });

    it("resolves basic object properties", () => {
      const data = { name: "Alice", age: 30 };
      expect(resolve(data).get("name").values()).toEqual(["Alice"]);
      expect(resolve(data).get("name").value()).toBe("Alice");
      expect(resolve(data).get("age").value()).toBe(30);
    });

    it("resolves deep nested object paths", () => {
      const data = {
        organization: {
          department: {
            lead: {
              name: "Bob",
              contact: { email: "bob@example.com" },
            },
          },
        },
      };

      expect(
        resolve(data).get("organization.department.lead.name").value()
      ).toBe("Bob");
      expect(
        resolve(data).get("organization.department.lead.contact.email").value()
      ).toBe("bob@example.com");
    });
  });

  describe("Array traversal and boundary flattening", () => {
    it("flattens single-level array boundary during property traversal (teams.members)", () => {
      const data = {
        teams: [
          {
            members: [{ name: "John" }, { name: "Shan" }],
          },
          {
            members: [{ name: "Alice" }, { name: "Bob" }],
          },
        ],
      };

      const members = resolve(data).get("teams.members").values();
      expect(members).toEqual([
        { name: "John" },
        { name: "Shan" },
        { name: "Alice" },
        { name: "Bob" },
      ]);

      const memberNames = resolve(data).get("teams.members.name").values();
      expect(memberNames).toEqual(["John", "Shan", "Alice", "Bob"]);
    });

    it("preserves nested array properties inside objects without collapsing", () => {
      const data = {
        users: [
          { name: "John", roles: ["admin", "user"] },
          { name: "Alice", roles: ["viewer"] },
        ],
      };

      const firstUser = resolve(data).get("users[0]").value();
      expect(firstUser).toEqual({ name: "John", roles: ["admin", "user"] });

      const allRoles = resolve(data).get("users.roles").values();
      expect(allRoles).toEqual(["admin", "user", "viewer"]);
    });

    it("handles indexing syntax and .at(index)", () => {
      const data = {
        users: [
          { name: "John", age: 30 },
          { name: "Shan", age: 25 },
          { name: "Alice", age: 28 },
        ],
      };

      expect(resolve(data).get("users[0]").value()).toEqual({
        name: "John",
        age: 30,
      });
      expect(resolve(data).get("users[1].name").value()).toBe("Shan");
      expect(resolve(data).get("users[2].age").value()).toBe(28);

      expect(resolve(data).get("users").at(0).get("name").value()).toBe("John");
      expect(resolve(data).get("users").at(1).get("name").value()).toBe("Shan");
      expect(resolve(data).get("users").at(99).values()).toEqual([]);
    });

    it("handles root array indexing", () => {
      const list = ["apple", "banana", "cherry"];
      expect(resolve(list).values()).toEqual(["apple", "banana", "cherry"]);
      expect(resolve(list).count()).toBe(3);
      expect(resolve(list).at(1).value()).toBe("banana");
      expect(resolve(list).get("[0]").value()).toBe("apple");
      expect(resolve(list).get("[2]").value()).toBe("cherry");
    });

    it("preserves array items on explicit index selection without accidental flattening", () => {
      const matrix = [
        [10, 20],
        [30, 40],
      ];

      // get("[0]") selects the first row [10, 20] as an array, not flattened to numbers
      expect(resolve(matrix).get("[0]").value()).toEqual([10, 20]);
      expect(resolve(matrix).get("[0]").values()).toEqual([[10, 20]]);
      expect(resolve(matrix).get("[1]").value()).toEqual([30, 40]);

      // at(0) selects the first row [10, 20]
      expect(resolve(matrix).at(0).value()).toEqual([10, 20]);
    });
  });

  describe("Filtering and predicates", () => {
    const dataset = {
      users: [
        { id: 1, name: "Alice", role: "admin", age: 35, active: true },
        { id: 2, name: "Bob", role: "user", age: 22, active: false },
        { id: 3, name: "Charlie", role: "admin", age: 40, active: true },
        { id: 4, name: "Danielle", role: "guest", age: 19, active: true },
      ],
    };

    it("filters using where() with case-insensitive substring matching", () => {
      const adminsFromWhere = resolve(dataset)
        .get("users")
        .where("role:admin")
        .values();
      expect(adminsFromWhere).toHaveLength(2);
      expect(adminsFromWhere.map((u) => u.name)).toEqual(["Alice", "Charlie"]);

      // Case-insensitive matching: "ADMIN", "admin", "superadmin"
      const adminsUpper = resolve(dataset)
        .get("users")
        .where("role:ADMIN")
        .values();
      expect(adminsUpper).toEqual(adminsFromWhere);

      const superadminsData = {
        users: [
          { name: "Root", role: "superadministrator" },
          { name: "Member", role: "member" },
        ],
      };
      const superadmins = resolve(superadminsData)
        .get("users")
        .where("role:admin")
        .values();
      expect(superadmins).toHaveLength(1);
      expect(superadmins[0]?.name).toBe("Root");
    });

    it("filters with equals, .not.equals, and double negation .not.not.equals", () => {
      const ages = resolve(dataset).get("users.age");
      expect(ages.equals(35)).toEqual([35]);
      expect(ages.not.equals(35)).toEqual([22, 40, 19]);
      expect(ages.not.not.equals(35)).toEqual([35]);

      expect(resolve([1, 2, 3]).equals(2)).toEqual([2]);
      expect(resolve([1, 2, 3]).not.equals(2)).toEqual([1, 3]);
      expect(resolve([1, 2, 3]).not.not.equals(2)).toEqual([2]);
    });

    it("ensures .not is stateless, immutable, and supports independent chains", () => {
      const resolver = resolve([1, 2, 3]);

      expect(resolver.equals(2)).toEqual([2]);
      expect(resolver.not.equals(2)).toEqual([1, 3]);
      expect(resolver.not.not.equals(2)).toEqual([2]);
      expect(resolver.equals(2)).toEqual([2]);
      expect(resolver.not.equals(1)).toEqual([2, 3]);
      expect(resolver.values()).toEqual([1, 2, 3]);

      const negative = resolver.not;
      expect(negative.equals(2)).toEqual([1, 3]);
      expect(resolver.equals(2)).toEqual([2]);
    });

    it("filters with contains, startsWith, endsWith and their .not counterparts", () => {
      const names = resolve(dataset).get("users.name");
      expect(names.contains("li")).toEqual(["Alice", "Charlie"]);
      expect(names.not.contains("li")).toEqual(["Bob", "Danielle"]);

      expect(names.startsWith("Dan")).toEqual(["Danielle"]);
      expect(names.not.startsWith("Dan")).toEqual(["Alice", "Bob", "Charlie"]);

      expect(names.endsWith("ie")).toEqual(["Charlie"]);
      expect(names.not.endsWith("ie")).toEqual(["Alice", "Bob", "Danielle"]);

      expect(names.endsWith("le")).toEqual(["Danielle"]);
      expect(names.not.endsWith("le")).toEqual(["Alice", "Bob", "Charlie"]);

      const fruits = ["apple", "banana", "apricot"];
      expect(resolve(fruits).startsWith("app")).toEqual(["apple"]);
      expect(resolve(fruits).not.startsWith("app")).toEqual(["banana", "apricot"]);
      expect(resolve(fruits).endsWith("le")).toEqual(["apple"]);
      expect(resolve(fruits).not.endsWith("le")).toEqual(["banana", "apricot"]);
    });

    it("uses array membership semantics for contains() and .not.contains() on arrays", () => {
      const roles = ["admin", "user"];
      expect(resolve(roles).contains("admin")).toEqual(["admin"]);
      expect(resolve(roles).not.contains("admin")).toEqual(["user"]);
      expect(resolve(roles).contains("guest")).toEqual([]);
      expect(resolve(roles).not.contains("guest")).toEqual(["admin", "user"]);

      const numbers = [123, 456];
      // 23 is NOT an element in [123, 456], even though it is a substring of 123
      expect(resolve(numbers).contains(23)).toEqual([]);
      expect(resolve(numbers).not.contains(23)).toEqual([123, 456]);
      expect(resolve(numbers).contains(123)).toEqual([123]);
      expect(resolve(numbers).not.contains(123)).toEqual([456]);

      const data = { roles: ["admin", "user"], ids: [1, 2, 3] };
      expect(resolve(data).get("roles").contains("admin")).toEqual(["admin"]);
      expect(resolve(data).get("roles").not.contains("admin")).toEqual(["user"]);
      expect(resolve(data).get("ids").contains(2)).toEqual([2]);
      expect(resolve(data).get("ids").not.contains(2)).toEqual([1, 3]);
    });

    it("supports deep path matching in where() including nested array members where ANY match qualifies", () => {
      const teamsData = {
        teams: [
          {
            teamName: "Core",
            lead: { role: "admin", name: "Alice" },
            members: [
              { name: "John", role: "developer" },
              { name: "Shan", role: "architect" },
            ],
          },
          {
            teamName: "Ops",
            lead: { role: "engineer", name: "Bob" },
            members: [
              { name: "Charlie", role: "support" },
            ],
          },
        ],
      };

      const adminTeams = resolve(teamsData)
        .get("teams")
        .where("lead.role:admin")
        .values();
      expect(adminTeams).toHaveLength(1);
      expect(adminTeams[0]?.teamName).toBe("Core");

      // Nested collection matching: if ANY member matches, the team qualifies
      const devTeams = resolve(teamsData)
        .get("teams")
        .where("members.role:developer")
        .values();
      expect(devTeams).toHaveLength(1);
      expect(devTeams[0]?.teamName).toBe("Core");

      const noMatchTeams = resolve(teamsData)
        .get("teams")
        .where("members.role:sales")
        .values();
      expect(noMatchTeams).toHaveLength(0);
    });

    it("filters with numeric comparisons and their .not counterparts", () => {
      const ages = resolve(dataset).get("users.age");
      expect(ages.greaterThan(30)).toEqual([35, 40]);
      expect(ages.not.greaterThan(30)).toEqual([22, 19]);

      expect(ages.greaterThanOrEqual(35)).toEqual([35, 40]);
      expect(ages.not.greaterThanOrEqual(35)).toEqual([22, 19]);

      expect(ages.lessThan(25)).toEqual([22, 19]);
      expect(ages.not.lessThan(25)).toEqual([35, 40]);

      expect(ages.lessThanOrEqual(22)).toEqual([22, 19]);
      expect(ages.not.lessThanOrEqual(22)).toEqual([35, 40]);

      const testNums = [10, 20, 30];
      expect(resolve(testNums).greaterThan(20)).toEqual([30]);
      expect(resolve(testNums).not.greaterThan(20)).toEqual([10, 20]);
      expect(resolve(testNums).greaterThanOrEqual(20)).toEqual([20, 30]);
      expect(resolve(testNums).not.greaterThanOrEqual(20)).toEqual([10]);
      expect(resolve(testNums).lessThan(20)).toEqual([10]);
      expect(resolve(testNums).not.lessThan(20)).toEqual([20, 30]);
      expect(resolve(testNums).lessThanOrEqual(20)).toEqual([10, 20]);
      expect(resolve(testNums).not.lessThanOrEqual(20)).toEqual([30]);
    });

    it("filters with null/undefined/truthy/falsy checks and their .not counterparts", () => {
      const items = {
        data: [null, undefined, 0, false, "", "text", 42, true],
      };

      expect(resolve(items).get("data").isNull()).toEqual([null]);
      expect(resolve(items).get("data").not.isNull()).toEqual([
        undefined,
        0,
        false,
        "",
        "text",
        42,
        true,
      ]);

      expect(resolve(items).get("data").isUndefined()).toEqual([undefined]);
      expect(resolve(items).get("data").not.isUndefined()).toEqual([
        null,
        0,
        false,
        "",
        "text",
        42,
        true,
      ]);

      expect(resolve(items).get("data").isTruthy()).toEqual(["text", 42, true]);
      expect(resolve(items).get("data").not.isTruthy()).toEqual([
        null,
        undefined,
        0,
        false,
        "",
      ]);

      expect(resolve(items).get("data").isFalsy()).toEqual([
        null,
        undefined,
        0,
        false,
        "",
      ]);
      expect(resolve(items).get("data").not.isFalsy()).toEqual(["text", 42, true]);
    });

    it("filters with regex matches and .not.matches", () => {
      const names = resolve(dataset).get("users.name");
      expect(names.matches(/^C/)).toEqual(["Charlie"]);
      expect(names.not.matches(/^C/)).toEqual(["Alice", "Bob", "Danielle"]);

      expect(names.matches(/e$/)).toEqual(["Alice", "Charlie", "Danielle"]);
      expect(names.not.matches(/e$/)).toEqual(["Bob"]);

      const list = ["Alice", "Bob", "Adam"];
      expect(resolve(list).matches(/^A/)).toEqual(["Alice", "Adam"]);
      expect(resolve(list).not.matches(/^A/)).toEqual(["Bob"]);
    });
  });

  describe("Aggregations and terminal operations", () => {
    it("supports value(), value(index), first(), last(), and values()", () => {
      const numbers = [10, 20, 30, 40];
      const r = resolve(numbers);

      expect(r.value()).toBe(10);
      expect(r.value(0)).toBe(10);
      expect(r.value(1)).toBe(20);
      expect(r.value(2)).toBe(30);
      expect(r.value(99)).toBeUndefined();
      // Negative index does not act as last, returns undefined
      expect(r.value(-1)).toBeUndefined();

      expect(r.first()).toBe(10);
      expect(r.last()).toBe(40);
      expect(r.values()).toEqual([10, 20, 30, 40]);
    });

    it("distinguishes between at(index) pipeline operation and value(index) terminal operation", () => {
      const users = [
        { name: "John", age: 30 },
        { name: "Shan", age: 25 },
        { name: "Alice", age: 28 },
      ];

      // at(index) returns a new Resolve pipeline instance that can be chained further
      const secondUserResolver = resolve(users).at(1);
      expect(secondUserResolver.get("name").value()).toBe("Shan");

      // value(index) returns the terminal value directly (not a Resolve object)
      const thirdUser = resolve(users).value(2);
      expect(thirdUser).toEqual({ name: "Alice", age: 28 });
    });

    it("ensures resolve() does not mutate input source", () => {
      const original = {
        users: [{ name: "John" }, { name: "Shan" }],
      };
      const copy = JSON.parse(JSON.stringify(original));

      resolve(original).get("users.name").values();
      resolve(original).get("users").at(0).value();
      resolve(original).where("users.name:John").values();

      expect(original).toEqual(copy);
    });

    it("computes count(), first(), last(), and exists()", () => {
      const empty: number[] = [];
      expect(resolve(empty).count()).toBe(0);
      expect(resolve(empty).exists()).toBe(false);
      expect(resolve(empty).first()).toBeUndefined();
      expect(resolve(empty).last()).toBeUndefined();

      const numbers = [10, 20, 30, 40];
      const r = resolve(numbers);
      expect(r.count()).toBe(4);
      expect(r.exists()).toBe(true);
      expect(r.first()).toBe(10);
      expect(r.last()).toBe(40);
    });

    it("computes sum() for homogeneous numbers and strings", () => {
      expect(resolve([1]).sum()).toBe(1);
      expect(resolve([1, 2]).sum()).toBe(3);
      expect(resolve([]).sum()).toBe(0);
      expect(resolve(["a"]).sum()).toBe("a");
      expect(resolve(["a", "b"]).sum()).toBe("ab");
      expect(resolve({ numbers: [10, 20, 30] }).get("numbers").sum()).toBe(60);
    });

    it("throws a TypeError when sum() encounters mixed or unsupported types", () => {
      expect(() => resolve([1, "2"]).sum()).toThrow(TypeError);
      expect(() => resolve(["a", 2]).sum()).toThrow(TypeError);
      expect(() => resolve([true]).sum()).toThrow(TypeError);
      expect(() => resolve([{ value: 1 }]).sum()).toThrow(TypeError);
      expect(() => resolve([null]).sum()).toThrow(TypeError);
      expect(() => resolve([undefined]).sum()).toThrow(TypeError);
    });
  });

  describe("Edge cases and error handling", () => {
    it("handles null and undefined source safely", () => {
      expect(resolve(null).values()).toEqual([]);
      expect(resolve(null).value()).toBeUndefined();
      expect(resolve(null).count()).toBe(0);
      expect(resolve(null).exists()).toBe(false);

      expect(resolve(undefined).values()).toEqual([]);
      expect(resolve(undefined).value()).toBeUndefined();
      expect(resolve(undefined).count()).toBe(0);
      expect(resolve(undefined).exists()).toBe(false);
    });

    it("handles missing property access gracefully", () => {
      const data = { user: { name: "John" } };
      // @ts-expect-error missing path test
      expect(resolve(data).get("user.missing.deep.property").values()).toEqual([]);
      // @ts-expect-error missing path test
      expect(resolve(data).get("user.missing").value()).toBeUndefined();
    });

    it("handles empty objects and empty arrays", () => {
      expect(resolve({}).values()).toEqual([{}]);
      expect(resolve({}).count()).toBe(1);
      expect(resolve([]).values()).toEqual([]);
      expect(resolve([]).count()).toBe(0);
    });

    it("handles global/sticky regexes consistently without lastIndex state issues", () => {
      const items = ["alpha", "alpha", "alpha", "beta", "alpha"];
      const globalRegex = /alpha/g;
      expect(resolve(items).matches(globalRegex)).toEqual([
        "alpha",
        "alpha",
        "alpha",
        "alpha",
      ]);
    });

    it("handles multi-dimensional array indexing", () => {
      const matrix = [
        [10, 20],
        [30, 40],
      ];
      expect(resolve(matrix).get("[0][1]").value()).toBe(20);
      expect(resolve(matrix).get("[1][0]").value()).toBe(30);

      const data = {
        matrix: [
          [10, 20],
          [30, 40],
        ],
      };
      expect(resolve(data).get("matrix[0][1]").value()).toBe(20);
    });

    it("handles Date comparisons and equality properly", () => {
      const d1 = new Date("2025-01-01T00:00:00.000Z");
      const d2 = new Date("2025-06-01T00:00:00.000Z");
      const d3 = new Date("2026-01-01T00:00:00.000Z");

      const dates = [d1, d2, d3];
      expect(resolve(dates).greaterThan(new Date("2025-03-01T00:00:00.000Z"))).toEqual([d2, d3]);
      expect(resolve(dates).not.greaterThan(new Date("2025-03-01T00:00:00.000Z"))).toEqual([d1]);
      expect(resolve(dates).equals(new Date("2025-01-01T00:00:00.000Z"))).toEqual([d1]);
      expect(resolve(dates).not.equals(new Date("2025-01-01T00:00:00.000Z"))).toEqual([d2, d3]);
    });
  });
});

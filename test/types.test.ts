import { describe, expectTypeOf, it } from "vitest";
import { resolve } from "../src";
import type { Path, ValueAtPath } from "../src/Resolve/types";

describe("Type Inference and Compile-time Checks", () => {
  interface User {
    id: number;
    name: string;
    roles: string[];
    active: boolean;
  }

  interface Team {
    teamName: string;
    members: User[];
  }

  interface RootData {
    teams: Team[];
    company: {
      location: string;
      founded: number;
    };
  }

  it("infers accurate types for object and array paths", () => {
    const data: RootData = {
      teams: [
        {
          teamName: "Core",
          members: [{ id: 1, name: "John", roles: ["admin"], active: true }],
        },
      ],
      company: {
        location: "San Francisco",
        founded: 2020,
      },
    };

    const locationResolver = resolve(data).get("company.location");
    expectTypeOf(locationResolver.value()).toEqualTypeOf<string | undefined>();
    expectTypeOf(locationResolver.values()).toEqualTypeOf<string[]>();

    const foundedResolver = resolve(data).get("company.founded");
    expectTypeOf(foundedResolver.value()).toEqualTypeOf<number | undefined>();

    const membersResolver = resolve(data).get("teams.members");
    expectTypeOf(membersResolver.values()).toEqualTypeOf<User[]>();

    const memberNamesResolver = resolve(data).get("teams.members.name");
    expectTypeOf(memberNamesResolver.values()).toEqualTypeOf<string[]>();
    expectTypeOf(memberNamesResolver.first()).toEqualTypeOf<string | undefined>();

    const indexedResolver = resolve(data).get("teams[0].members[0].name");
    expectTypeOf(indexedResolver.value()).toEqualTypeOf<string | undefined>();
  });

  it("checks Path<T> and ValueAtPath<T, P> types", () => {
    type DataPath = Path<RootData>;

    const p1: DataPath = "teams";
    const p2: DataPath = "teams.teamName";
    const p3: DataPath = "teams.members";
    const p4: DataPath = "teams.members.name";
    const p5: DataPath = "teams[0].members[0].roles";
    const p6: DataPath = "company.location";

    expectTypeOf(p1).toMatchTypeOf<string>();
    expectTypeOf(p2).toMatchTypeOf<string>();
    expectTypeOf(p3).toMatchTypeOf<string>();
    expectTypeOf(p4).toMatchTypeOf<string>();
    expectTypeOf(p5).toMatchTypeOf<string>();
    expectTypeOf(p6).toMatchTypeOf<string>();

    type Val = ValueAtPath<RootData, "company.location">;
    expectTypeOf<Val>().toEqualTypeOf<string>();

    type MembersVal = ValueAtPath<RootData, "teams.members">;
    expectTypeOf<MembersVal>().toEqualTypeOf<User[]>();

    type MemberNameVal = ValueAtPath<RootData, "teams.members.name">;
    expectTypeOf<MemberNameVal>().toEqualTypeOf<string>();
  });

  it("enforces strict type safety for equals and notEquals", () => {
    const data = {
      age: 30,
      name: "John",
      active: true,
    };

    // Valid comparisons
    resolve(data).get("age").equals(30);
    resolve(data).get("name").equals("John");
    resolve(data).get("active").equals(true);

    resolve(data).get("age").notEquals(30);
    resolve(data).get("name").notEquals("John");
    resolve(data).get("active").notEquals(true);

    // Invalid comparisons should fail at compile time
    // @ts-expect-error type mismatch: number vs string
    resolve(data).get("age").equals("30");

    // @ts-expect-error type mismatch: string vs number
    resolve(data).get("name").equals(30);

    // @ts-expect-error type mismatch: boolean vs string
    resolve(data).get("active").equals("true");

    // @ts-expect-error type mismatch: number vs string
    resolve(data).get("age").notEquals("30");

    // @ts-expect-error type mismatch: string vs number
    resolve(data).get("name").notEquals(30);

    // @ts-expect-error type mismatch: boolean vs string
    resolve(data).get("active").notEquals("true");
  });

  it("enforces type safety for contains() and sum()", () => {
    const data = {
      roles: ["admin", "user"],
      ids: [1, 2, 3],
    };

    resolve(data).get("roles").contains("admin");
    resolve(data).get("ids").contains(2);

    // @ts-expect-error type mismatch: number[] does not contain string
    resolve(data).get("ids").contains("invalid");

    const numSum = resolve([1, 2, 3]).sum();
    expectTypeOf(numSum).toEqualTypeOf<number>();

    const strSum = resolve(["a", "b"]).sum();
    expectTypeOf(strSum).toEqualTypeOf<string>();
  });
});

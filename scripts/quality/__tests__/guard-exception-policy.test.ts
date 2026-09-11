import { pathToFileURL } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function loadPolicy(): Promise<{
  defineGuardExceptions: (
    guard: string,
    entries: Array<Record<string, unknown>>,
    options?: { requiredMatchFields?: string[] },
  ) => ReadonlyArray<Record<string, unknown>>;
}> {
  const modulePath = path.resolve(__dirname, "..", "guard-exception-policy.mjs");
  return (await import(pathToFileURL(modulePath).href)) as never;
}

describe("guard exception declarations", () => {
  it("accepts and freezes an exception with why, owner, and review trigger metadata", async () => {
    const { defineGuardExceptions } = await loadPolicy();

    const declarations = defineGuardExceptions("guard:fixture", [
      {
        id: "fixture-bootstrap",
        path: "app/api/fixture/route.ts",
        reason: "the fixture has to bootstrap before the canonical owner exists",
        owner: "app/server/fixture-owner.ts",
        reviewWhen: "review when fixture bootstrap is retired",
      },
    ]);

    expect(declarations).toHaveLength(1);
    expect(Object.isFrozen(declarations)).toBe(true);
    expect(Object.isFrozen(declarations[0])).toBe(true);
  });

  it.each(["reason", "owner", "reviewWhen"])(
    "rejects an exception without non-empty %s metadata",
    async (missingField) => {
      const { defineGuardExceptions } = await loadPolicy();
      const entry = {
        id: "fixture-bootstrap",
        reason: "bootstrap reason",
        owner: "fixture owner",
        reviewWhen: "fixture retirement",
        [missingField]: " ",
      };

      expect(() => defineGuardExceptions("guard:fixture", [entry])).toThrow(
        `requires non-empty ${missingField} metadata`,
      );
    },
  );

  it("rejects duplicate exception identities", async () => {
    const { defineGuardExceptions } = await loadPolicy();
    const entry = {
      id: "fixture-bootstrap",
      reason: "bootstrap reason",
      owner: "fixture owner",
      reviewWhen: "fixture retirement",
    };

    expect(() => defineGuardExceptions("guard:fixture", [entry, entry])).toThrow(
      "duplicate exception id: fixture-bootstrap",
    );
  });

  it("rejects missing guard-specific match data", async () => {
    const { defineGuardExceptions } = await loadPolicy();

    expect(() =>
      defineGuardExceptions(
        "guard:fixture",
        [
          {
            id: "fixture-bootstrap",
            reason: "bootstrap reason",
            owner: "fixture owner",
            reviewWhen: "fixture retirement",
          },
        ],
        { requiredMatchFields: ["path"] },
      ),
    ).toThrow("requires non-empty path match data");
  });

  it("rejects an owner that only repeats the exception match", async () => {
    const { defineGuardExceptions } = await loadPolicy();

    expect(() =>
      defineGuardExceptions(
        "guard:fixture",
        [
          {
            id: "fixture-bootstrap",
            path: "app/api/fixture/route.ts",
            reason: "bootstrap reason",
            owner: "app/api/fixture/route.ts",
            reviewWhen: "fixture retirement",
          },
        ],
        { requiredMatchFields: ["path"] },
      ),
    ).toThrow("owner must identify accountable authority, not repeat path");
  });
});

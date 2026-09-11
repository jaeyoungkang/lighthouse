import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type ContractDocument = {
  version: number;
  defaultUnexpectedFailure: Record<string, unknown>;
  routes: Array<Record<string, unknown>>;
};

async function loadGuard(): Promise<{
  validateApiResponseContract: (
    root?: string,
    contract?: ContractDocument,
  ) => Promise<{
    ok: boolean;
    routeCount: number;
    exemptionCount: number;
    violations: string[];
  }>;
}> {
  const guardPath = path.resolve(__dirname, "..", "check-api-response-contract.mjs");
  return (await import(pathToFileURL(guardPath).href)) as never;
}

function contract(overrides: Record<string, unknown> = {}): ContractDocument {
  return {
    version: 1,
    defaultUnexpectedFailure: {
      status: 500,
      code: "API_INTERNAL_ERROR",
      action: "retry",
      retryable: true,
    },
    routes: [
      {
        path: "app/api/example/route.ts",
        methods: ["POST"],
        successStatuses: [200],
        degradedSuccess: [],
        correctableFailures: [
          {
            statuses: [400],
            codes: ["EXAMPLE_INVALID"],
            action: "correct-request",
            retryable: false,
          },
        ],
        authFailures: [],
        conflictFailures: [],
        overloadFailures: [],
        transientFailures: [
          {
            statuses: [500],
            codes: ["API_INTERNAL_ERROR"],
            action: "retry",
            retryable: true,
          },
        ],
        unexpectedFailure: "stable-envelope",
        ...overrides,
      },
    ],
  };
}

describe("API response contract guard", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "api-response-contract-"));
    await mkdir(path.join(root, "app/api/example"), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  async function writeRoute(source: string): Promise<void> {
    await writeFile(path.join(root, "app/api/example/route.ts"), source);
  }

  it("accepts a complete route inventory with a stable envelope owner", async () => {
    await writeRoute(`
export const POST = withRouteGuard(async () => Response.json({ ok: true }));
`);
    const { validateApiResponseContract } = await loadGuard();

    await expect(validateApiResponseContract(root, contract())).resolves.toEqual({
      ok: true,
      routeCount: 1,
      exemptionCount: 0,
      violations: [],
    });
  });

  it("rejects a direct message-only error response", async () => {
    await writeRoute(`
export async function POST() {
  return NextResponse.json({ error: "bad request" }, { status: 400 });
}
`);
    const { validateApiResponseContract } = await loadGuard();
    const result = await validateApiResponseContract(
      root,
      contract({ unexpectedFailure: "not-applicable", transientFailures: [] }),
    );

    expect(result.violations).toContain(
      "app/api/example/route.ts: direct message-only error response bypasses apiErrorResponse",
    );
  });

  it("rejects retry-storm mappings and 429 without server backoff", async () => {
    await writeRoute(`
export const POST = withRouteGuard(async () => Response.json({ ok: true }));
`);
    const { validateApiResponseContract } = await loadGuard();
    const result = await validateApiResponseContract(
      root,
      contract({
        correctableFailures: [
          {
            statuses: [400],
            codes: ["EXAMPLE_INVALID"],
            action: "retry",
            retryable: true,
          },
        ],
        overloadFailures: [
          {
            statuses: [429],
            codes: ["EXAMPLE_RATE_LIMITED"],
            action: "wait-and-retry",
            retryable: true,
          },
        ],
      }),
    );

    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/api/example/route.ts: correctableFailures[0] status 400 must map to correct-request/false",
        "app/api/example/route.ts: overloadFailures[0] status 429 must declare retry-after backoff",
      ]),
    );
  });

  it("rejects incomplete route, success, and failure inventories", async () => {
    await writeRoute(`
export async function POST() {
  return Response.json({ ok: true });
}
`);
    const { validateApiResponseContract } = await loadGuard();
    const result = await validateApiResponseContract(
      root,
      contract({
        methods: [],
        successStatuses: [300],
        degradedSuccess: [""],
        authFailures: undefined,
        conflictFailures: [
          {
            statuses: [],
          },
        ],
        unexpectedFailure: "made-up",
      }),
    );

    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/api/example/route.ts: methods inventory is empty",
        "app/api/example/route.ts: successStatuses contains a non-2xx status",
        "app/api/example/route.ts: degradedSuccess inventory is missing or invalid",
        "app/api/example/route.ts: authFailures inventory is missing",
        "app/api/example/route.ts: conflictFailures[0] statuses are incomplete",
        "app/api/example/route.ts: unexpectedFailure policy is missing or invalid",
      ]),
    );
  });

  it.each([
    ["correctableFailures", 422, "retry", true, "correct-request/false"],
    ["authFailures", 401, "retry", true, "authenticate/false"],
    ["authFailures", 403, "retry", true, "request-permission/false"],
    ["correctableFailures", 404, "retry", true, "clear-missing-state/false"],
    ["correctableFailures", 410, "retry", true, "clear-missing-state/false"],
    ["conflictFailures", 409, "retry", true, "refresh-and-rebase/false"],
    ["correctableFailures", 413, "retry", true, "reduce-request/false"],
    ["overloadFailures", 429, "retry", false, "wait-and-retry/true"],
    ["transientFailures", 500, "stop", false, "retry/true"],
  ] as const)(
    "rejects an invalid %s status %i action mapping",
    async (field, status, action, retryable, expectedMeaning) => {
      await writeRoute(`
export const POST = withRouteGuard(async () => Response.json({ ok: true }));
`);
      const { validateApiResponseContract } = await loadGuard();
      const result = await validateApiResponseContract(
        root,
        contract({
          [field]: [
            {
              statuses: [status],
              codes: ["EXAMPLE_FAILURE"],
              action,
              retryable,
              ...(status === 429 ? { backoff: "retry-after" } : {}),
            },
          ],
        }),
      );

      expect(result.violations).toContain(
        `app/api/example/route.ts: ${field}[0] status ${String(status)} must map to ${expectedMeaning}`,
      );
    },
  );

  it("rejects duplicate routes and an unowned stable envelope", async () => {
    await writeRoute(`
export async function POST() {
  return Response.json({ ok: true });
}
`);
    const { validateApiResponseContract } = await loadGuard();
    const base = contract();
    const result = await validateApiResponseContract(root, {
      ...base,
      routes: [base.routes[0], { ...base.routes[0] }],
    });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/server/operational/api-response-contract.json: duplicate route contract 'app/api/example/route.ts'",
        "app/api/example/route.ts: stable unexpected failure has no response-envelope owner",
      ]),
    );
  });

  it.each([
    ["status", 503],
    ["code", "EXAMPLE_INTERNAL_ERROR"],
    ["action", "stop"],
    ["retryable", false],
  ] as const)("rejects an invalid default unexpected-failure %s", async (field, value) => {
    await writeRoute(`
export const POST = withRouteGuard(async () => Response.json({ ok: true }));
`);
    const { validateApiResponseContract } = await loadGuard();
    const base = contract();
    const result = await validateApiResponseContract(root, {
      ...base,
      defaultUnexpectedFailure: {
        ...base.defaultUnexpectedFailure,
        [field]: value,
      },
    });

    expect(result.violations).toContain(
      "app/server/operational/api-response-contract.json: defaultUnexpectedFailure must be stable retryable 500",
    );
  });

  it("rejects malformed failure codes, actions, and terminal 4xx mappings", async () => {
    await writeRoute(`
export const POST = withRouteGuard(async () => Response.json({ ok: true }));
`);
    const { validateApiResponseContract } = await loadGuard();
    const result = await validateApiResponseContract(
      root,
      contract({
        overloadFailures: [
          {
            statuses: [429],
            codes: [""],
            action: "made-up",
            retryable: "yes",
          },
        ],
        terminalFailures: [
          {
            statuses: [400],
            codes: ["EXAMPLE_TERMINAL"],
            action: "stop",
            retryable: false,
          },
        ],
      }),
    );

    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/api/example/route.ts: overloadFailures[0] stable codes are incomplete",
        "app/api/example/route.ts: overloadFailures[0] action/retryable meaning is incomplete",
        "app/api/example/route.ts: terminalFailures[0] terminalFailures may contain only 5xx statuses",
      ]),
    );
  });

  it.each([
    ["action", "made-up", true],
    ["retryable", "retry", "yes"],
  ] as const)(
    "rejects an independently malformed failure %s field",
    async (_field, action, retryable) => {
      await writeRoute(`
export const POST = withRouteGuard(async () => Response.json({ ok: true }));
`);
      const { validateApiResponseContract } = await loadGuard();
      const result = await validateApiResponseContract(
        root,
        contract({
          transientFailures: [
            {
              statuses: [500],
              codes: ["EXAMPLE_FAILURE"],
              action,
              retryable,
            },
          ],
        }),
      );

      expect(result.violations).toContain(
        "app/api/example/route.ts: transientFailures[0] action/retryable meaning is incomplete",
      );
    },
  );

  it.each([
    ["successStatuses", "app/api/example/route.ts: successStatuses inventory is missing"],
    [
      "degradedSuccess",
      "app/api/example/route.ts: degradedSuccess inventory is missing or invalid",
    ],
  ] as const)("rejects a missing %s inventory", async (field, expectedViolation) => {
    await writeRoute(`
export const POST = withRouteGuard(async () => Response.json({ ok: true }));
`);
    const { validateApiResponseContract } = await loadGuard();
    const result = await validateApiResponseContract(root, contract({ [field]: undefined }));

    expect(result.violations).toContain(expectedViolation);
  });

  it("rejects missing and stale route inventory entries", async () => {
    await writeRoute(
      "export const POST = withRouteGuard(async () => Response.json({ ok: true }));",
    );
    const { validateApiResponseContract } = await loadGuard();
    const result = await validateApiResponseContract(root, {
      ...contract(),
      routes: [{ ...contract().routes[0], path: "app/api/retired/route.ts" }],
    });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/server/operational/api-response-contract.json: missing route 'app/api/example/route.ts'",
        "app/server/operational/api-response-contract.json: stale route 'app/api/retired/route.ts'",
      ]),
    );
  });

  it("rejects an uninventoried Route Handler outside app/api", async () => {
    await writeRoute(
      "export const POST = withRouteGuard(async () => Response.json({ ok: true }));",
    );
    await mkdir(path.join(root, "app/auth/callback"), { recursive: true });
    await writeFile(
      path.join(root, "app/auth/callback/route.ts"),
      "export async function GET() { return Response.redirect('https://example.com'); }\n",
    );
    const { validateApiResponseContract } = await loadGuard();

    const result = await validateApiResponseContract(root, contract());

    expect(result.routeCount).toBe(2);
    expect(result.violations).toContain(
      "app/server/operational/api-response-contract.json: missing route 'app/auth/callback/route.ts'",
    );
  });

  it("accepts the redirect-only auth exception and rejects it when stale", async () => {
    await writeRoute(
      "export const POST = withRouteGuard(async () => Response.json({ ok: true }));",
    );
    await mkdir(path.join(root, "app/auth/confirm"), { recursive: true });
    await writeFile(
      path.join(root, "app/auth/confirm/route.ts"),
      "export async function GET() { return Response.redirect('https://example.com'); }\n",
    );
    await mkdir(path.join(root, "app/server/operational"), { recursive: true });
    await writeFile(
      path.join(root, "app/server/operational/api-response-contract.json"),
      `${JSON.stringify(contract(), null, 2)}\n`,
    );
    const { validateApiResponseContract } = await loadGuard();

    await expect(validateApiResponseContract(root)).resolves.toEqual({
      ok: true,
      routeCount: 2,
      exemptionCount: 1,
      violations: [],
    });

    await rm(path.join(root, "app/auth/confirm/route.ts"));
    const staleResult = await validateApiResponseContract(root);

    expect(staleResult.ok).toBe(false);
    expect(staleResult.violations).toContain(
      "app/server/operational/api-response-contract.json: stale Route Handler exemption 'auth-confirm-redirect-only' (app/auth/confirm/route.ts)",
    );
  });

  it("allows an Error Catalog 5xx to be explicitly terminal", async () => {
    await writeRoute(`
export const POST = withRouteGuard(async () => Response.json({ ok: true }));
`);
    const { validateApiResponseContract } = await loadGuard();
    const result = await validateApiResponseContract(
      root,
      contract({
        terminalFailures: [
          {
            statuses: [500],
            codes: ["SEARCH_PARSE_FAILED"],
            action: "stop",
            retryable: false,
          },
        ],
      }),
    );

    expect(result.violations).toEqual([]);
  });

  it("binds each literal apiErrorResponse to the same route inventory", async () => {
    await writeRoute(`
export const POST = withRouteGuard(async () => apiErrorResponse({
  status: 429,
  code: "EXAMPLE_BUSY",
  message: "busy",
}));
`);
    const { validateApiResponseContract } = await loadGuard();

    const missing = await validateApiResponseContract(root, contract());
    expect(missing.violations).toContain(
      "app/api/example/route.ts: literal apiErrorResponse 429/EXAMPLE_BUSY is missing from this route inventory",
    );

    const matching = await validateApiResponseContract(
      root,
      contract({
        overloadFailures: [
          {
            statuses: [429],
            codes: ["EXAMPLE_BUSY"],
            action: "wait-and-retry",
            retryable: true,
            backoff: "retry-after",
          },
        ],
      }),
    );
    expect(matching.violations).toEqual([]);
  });
});

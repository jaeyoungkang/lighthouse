import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type PolicyDocument = {
  version: number;
  routes: Array<Record<string, unknown>>;
};

async function loadGuard(): Promise<{
  validateRouteIngressPolicy: (
    root?: string,
    policyDocument?: PolicyDocument,
  ) => Promise<{ ok: boolean; routeCount: number; violations: string[] }>;
}> {
  const guardPath = path.resolve(__dirname, "..", "check-route-ingress-policy.mjs");
  return (await import(pathToFileURL(guardPath).href)) as never;
}

function policy(overrides: Record<string, unknown> = {}): PolicyDocument {
  return {
    version: 1,
    routes: [
      {
        path: "app/api/example/route.ts",
        methods: ["POST"],
        visibility: "authenticated",
        work: ["llm"],
        access: "ephemeral",
        body: {
          maxBytes: 4096,
          fieldCardinality: "query <= 500 chars",
        },
        authOrder: "auth-before-body",
        admission: [],
        platformAdmission: "unknown",
        deadlineSeconds: 30,
        ...overrides,
      },
    ],
  };
}

describe("route ingress policy guard", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "route-ingress-policy-"));
    await mkdir(path.join(root, "app/api/example"), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  async function writeRoute(source: string): Promise<void> {
    await writeFile(path.join(root, "app/api/example/route.ts"), source);
  }

  it("accepts a complete bounded body route inventory", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();

    await expect(validateRouteIngressPolicy(root, policy())).resolves.toEqual({
      ok: true,
      routeCount: 1,
      violations: [],
    });
  });

  it("fails when a route bypasses the bounded body reader", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  return Response.json(await req.json());
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();
    const result = await validateRouteIngressPolicy(root, policy());

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/api/example/route.ts: direct request.json() bypasses the bounded body reader",
        "app/api/example/route.ts: body route does not use a bounded body reader",
      ]),
    );
  });

  it("fails deadline drift and incomplete body cardinality policy", async () => {
    await writeRoute(`
export const maxDuration = 60;
export async function POST(req: Request) {
  const body = await readBoundedJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();
    const result = await validateRouteIngressPolicy(
      root,
      policy({ body: { maxBytes: 4096, fieldCardinality: "" } }),
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/api/example/route.ts: maxDuration 60 does not match inventory 30",
        "app/api/example/route.ts: body byte/field/cardinality budget is incomplete",
      ]),
    );
  });

  it("fails method inventory drift", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();
    const result = await validateRouteIngressPolicy(
      root,
      policy({
        methods: ["PUT"],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      'app/api/example/route.ts: methods ["PUT"] do not match exports ["POST"]',
    );
  });

  it("fails incomplete route metadata and duplicate inventory entries", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();
    const incomplete = policy({
      methods: [],
      visibility: "",
      access: "",
      authOrder: "",
      platformAdmission: "",
      work: [],
      admission: undefined,
    });
    const result = await validateRouteIngressPolicy(root, {
      ...incomplete,
      routes: [incomplete.routes[0], { ...incomplete.routes[0] }],
    });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/server/operational/route-ingress-policy.json: duplicate route policy 'app/api/example/route.ts'",
        "app/api/example/route.ts: methods inventory is empty",
        "app/api/example/route.ts: missing policy field 'visibility'",
        "app/api/example/route.ts: missing policy field 'access'",
        "app/api/example/route.ts: missing policy field 'authOrder'",
        "app/api/example/route.ts: missing policy field 'platformAdmission'",
        "app/api/example/route.ts: work inventory is empty",
        "app/api/example/route.ts: admission inventory is missing",
      ]),
    );
  });

  it("reports a missing methods inventory without aborting validation", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();

    const result = await validateRouteIngressPolicy(
      root,
      policy({ methods: undefined, deadlineSeconds: 60 }),
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/api/example/route.ts: methods inventory is empty",
        "app/api/example/route.ts: maxDuration 30 does not match inventory 60",
      ]),
    );
  });

  it("fails incomplete admission ownership and every fixed-budget dimension", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();
    const result = await validateRouteIngressPolicy(
      root,
      policy({
        admission: [
          { id: "missing-owner" },
          {
            id: "invalid-request-budget",
            owner: "app/server/operational/example.ts",
            key: "principal",
            maxRequests: 0,
            windowMs: 1,
            maxKeys: 1,
          },
          {
            id: "invalid-window-budget",
            owner: "app/server/operational/example.ts",
            key: "principal",
            maxRequests: 1,
            windowMs: 0,
            maxKeys: 1,
          },
          {
            id: "invalid-key-budget",
            owner: "app/server/operational/example.ts",
            key: "principal",
            maxRequests: 1,
            windowMs: 1,
            maxKeys: 0,
          },
        ],
      }),
    );

    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/api/example/route.ts: admission owner/id is incomplete",
        "app/api/example/route.ts: fixed admission budget 'invalid-request-budget' is invalid",
        "app/api/example/route.ts: fixed admission budget 'invalid-window-budget' is invalid",
        "app/api/example/route.ts: fixed admission budget 'invalid-key-budget' is invalid",
      ]),
    );
  });

  it("fails a body route that does not consume its inventory byte owner", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  return Response.json(await readRouteJsonBody(req, { maxBytes: 4096 }));
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();
    const result = await validateRouteIngressPolicy(root, policy());

    expect(result.violations).toContain(
      "app/api/example/route.ts: body route does not consume its inventoried byte budget",
    );
  });

  it("fails an invalid body byte budget even when cardinality is present", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();
    const result = await validateRouteIngressPolicy(
      root,
      policy({ body: { maxBytes: 0, fieldCardinality: "query <= 500 chars" } }),
    );

    expect(result.violations).toContain(
      "app/api/example/route.ts: body byte/field/cardinality budget is incomplete",
    );
  });

  it("fails a non-numeric body byte budget", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();
    const result = await validateRouteIngressPolicy(
      root,
      policy({ body: { maxBytes: "4096", fieldCardinality: "query <= 500 chars" } }),
    );

    expect(result.violations).toContain(
      "app/api/example/route.ts: body byte/field/cardinality budget is incomplete",
    );
  });

  it("fails a non-string body cardinality declaration", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    const { validateRouteIngressPolicy } = await loadGuard();
    const result = await validateRouteIngressPolicy(
      root,
      policy({ body: { maxBytes: 4096, fieldCardinality: 500 } }),
    );

    expect(result.violations).toContain(
      "app/api/example/route.ts: body byte/field/cardinality budget is incomplete",
    );
  });

  it("fails missing and stale inventory entries", async () => {
    await writeRoute("export const maxDuration = 30;\n");
    const { validateRouteIngressPolicy } = await loadGuard();
    const result = await validateRouteIngressPolicy(root, {
      version: 1,
      routes: [
        {
          ...policy().routes[0],
          path: "app/api/retired/route.ts",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        "app/server/operational/route-ingress-policy.json: missing route 'app/api/example/route.ts'",
        "app/server/operational/route-ingress-policy.json: stale route 'app/api/retired/route.ts'",
      ]),
    );
  });

  it("fails when a Route Handler outside app/api is missing from the inventory", async () => {
    await writeRoute(`
export const maxDuration = 30;
export async function POST(req: Request) {
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/example/route.ts"));
  return Response.json(body);
}
`);
    await mkdir(path.join(root, "app/auth/callback"), { recursive: true });
    await writeFile(
      path.join(root, "app/auth/callback/route.ts"),
      "export const maxDuration = 15;\nexport async function GET() { return new Response(); }\n",
    );
    const { validateRouteIngressPolicy } = await loadGuard();

    const result = await validateRouteIngressPolicy(root, policy());

    expect(result.routeCount).toBe(2);
    expect(result.violations).toContain(
      "app/server/operational/route-ingress-policy.json: missing route 'app/auth/callback/route.ts'",
    );
  });

  it("binds the shared gap-report byte owner to the route inventory", async () => {
    await rm(path.join(root, "app/api/example"), { force: true, recursive: true });
    await mkdir(path.join(root, "app/api/gap-reports"), { recursive: true });
    await mkdir(path.join(root, "app/lib"), { recursive: true });
    await writeFile(
      path.join(root, "app/api/gap-reports/route.ts"),
      `export const maxDuration = 60;
export async function POST(req: Request) {
  return Response.json(await readBoundedJsonBody(req, { maxBytes: GAP_REPORT_REQUEST_MAX_BYTES }));
}
`,
    );
    await writeFile(
      path.join(root, "app/lib/gap-report-input-budget.ts"),
      "export const GAP_REPORT_REQUEST_MAX_BYTES = 1_000;\n",
    );
    const { validateRouteIngressPolicy } = await loadGuard();
    const gapPolicy = policy({
      path: "app/api/gap-reports/route.ts",
      deadlineSeconds: 60,
      body: { maxBytes: 2_000, fieldCardinality: "papers <= 40" },
    });

    const result = await validateRouteIngressPolicy(root, gapPolicy);

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "app/api/gap-reports/route.ts: GAP_REPORT_REQUEST_MAX_BYTES 1000 does not match inventory 2000",
    );
  });
});

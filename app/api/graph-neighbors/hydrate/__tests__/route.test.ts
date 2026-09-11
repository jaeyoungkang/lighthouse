import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphNeighborsMetadata } from "@/app/domain/research-route-payload";
import { UnauthenticatedError } from "@/app/server/auth/auth-errors";

type HydrateGraphNeighborSnapshotMock = (input: { metadata: GraphNeighborsMetadata }) => Promise<{
  metadata: GraphNeighborsMetadata;
  updatedAt: string;
}>;

const hydrateGraphNeighborSnapshot = vi.hoisted(() => vi.fn<HydrateGraphNeighborSnapshotMock>());
const requireOwnerPrincipalAuth = vi.hoisted(() => vi.fn());

vi.mock("@/app/server/domain-access/graph-neighbor-hydration-access", () => ({
  hydrateGraphNeighborSnapshot,
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

const authContext = {
  db: {},
  source: "moonlight_scholar",
  user: { id: "principal-1", email: "pilot@example.com" },
} as const;

function buildPaper(paperId: string): GraphNeighborsMetadata["papers"][number] {
  return {
    paperId,
    title: `Paper ${paperId}`,
    abstract: null,
    year: 2026,
    citationCount: 0,
    url: `https://example.com/${paperId}`,
    authors: [{ name: "Ada" }],
  };
}

function buildMetadata(count: number): GraphNeighborsMetadata {
  const papers = Array.from({ length: count }, (_, index) => buildPaper(String(index + 1)));
  return {
    type: "graph_neighbors",
    seedPaper: buildPaper("seed"),
    papers,
    total: papers.length,
    coCited: papers.map((paper) => ({ shared: 1, paper })),
    coupled: papers.map((paper) => ({ shared: 1, paper })),
    cardDataHydration: { status: "pending" },
    coCitedAvailability: null,
    coupledAvailability: null,
  };
}

describe("graph-neighbor hydration route", () => {
  beforeEach(() => {
    requireOwnerPrincipalAuth.mockReset();
    requireOwnerPrincipalAuth.mockResolvedValue(authContext);
    hydrateGraphNeighborSnapshot.mockReset();
    hydrateGraphNeighborSnapshot.mockImplementation(({ metadata }) =>
      Promise.resolve({
        metadata,
        updatedAt: "2026-07-06T00:00:00.000Z",
      }),
    );
  });

  it("rejects oversized graph-neighbor hydration payloads before domain access", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/graph-neighbors/hydrate", {
        method: "POST",
        body: JSON.stringify({ metadata: buildMetadata(201) }),
      }),
    );

    expect(response.status).toBe(400);
    expect(hydrateGraphNeighborSnapshot).not.toHaveBeenCalled();
  });

  it("accepts capped graph-neighbor hydration payloads", async () => {
    const metadata = buildMetadata(199);
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/graph-neighbors/hydrate", {
        method: "POST",
        body: JSON.stringify({ metadata }),
      }),
    );

    expect(response.status).toBe(200);
    expect(hydrateGraphNeighborSnapshot).toHaveBeenCalledWith(
      { metadata },
      expect.any(AbortSignal),
      authContext,
    );
    await expect(response.json()).resolves.toEqual({
      metadata,
      updatedAt: "2026-07-06T00:00:00.000Z",
    });
  });

  it.each(["papers", "coCited", "coupled"] as const)(
    "rejects an oversized %s collection independently",
    async (collection) => {
      const metadata = buildMetadata(200);
      if (collection === "papers") {
        metadata.papers.push(buildPaper("overflow"));
      } else {
        metadata[collection].push({ shared: 1, paper: buildPaper("overflow") });
      }
      const { POST } = await import("../route");

      const response = await POST(
        new Request("http://localhost/api/graph-neighbors/hydrate", {
          method: "POST",
          body: JSON.stringify({ metadata }),
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: "GRAPH_NEIGHBOR_HYDRATION_INVALID",
        error: "invalid graph-neighbor hydration payload",
      });
      expect(hydrateGraphNeighborSnapshot).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing metadata envelope instead of calling domain access", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/api/graph-neighbors/hydrate", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(hydrateGraphNeighborSnapshot).not.toHaveBeenCalled();
  });

  it("returns the body-reader failure without calling domain access", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("http://localhost/api/graph-neighbors/hydrate", {
        method: "POST",
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(hydrateGraphNeighborSnapshot).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests before body read or provider hydration", async () => {
    requireOwnerPrincipalAuth.mockRejectedValue(new UnauthenticatedError());
    let bodyRead = false;
    const request = {
      headers: new Headers(),
      signal: new AbortController().signal,
      get body() {
        bodyRead = true;
        throw new Error("body should not be read");
      },
    } as unknown as Request;
    const { POST } = await import("../route");

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(bodyRead).toBe(false);
    expect(hydrateGraphNeighborSnapshot).not.toHaveBeenCalled();
  });
});

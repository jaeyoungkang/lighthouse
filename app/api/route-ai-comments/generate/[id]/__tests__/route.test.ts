import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import type { ViewSnapshot } from "@/app/domain/view-snapshot";
import { routeAiCommentGenerateRoute } from "@/app/lib/api-routes";
import { UnauthenticatedError } from "@/app/server/auth/auth-errors";

type GenerateRouteAiCommentMock = (params: {
  db: unknown;
  ownerPrincipalId: string;
  viewSnapshot: ViewSnapshot;
  userId?: string;
  trigger?: string;
  signal?: AbortSignal;
}) => Promise<RouteAiComment | null>;

const { generateRouteAiComment, requireOwnerPrincipalAuth } = vi.hoisted(() => ({
  generateRouteAiComment: vi.fn<GenerateRouteAiCommentMock>(),
  requireOwnerPrincipalAuth: vi.fn(),
}));

function reactionGenerateUrl(viewId: string): string {
  return `http://localhost${routeAiCommentGenerateRoute(viewId)}`;
}

vi.mock("@/app/server/agent/route-ai-comment-generation", () => ({
  generateRouteAiComment,
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

const reaction: RouteAiComment = {
  id: "reaction-1",
  title: "검색 반응",
  body: "상위 결과의 흐름을 정리했다.",
  chips: [],
  timestamp: "2026-06-01T00:00:00.000Z",
};

const viewSnapshot: ViewSnapshot = {
  snapshotId: "search-ephemeral-1",
  snapshotKind: "search",
  title: "검색",
  content: {
    kind: "search",
    query: "llm",
    total: 1,
    results: [{ id: "paper-1", title: "Paper 1", year: 2026, citationCount: 7 }],
  },
};

const generationCreatedAt = Date.parse("2026-06-01T00:00:00.000Z");

async function flushRouteMicrotasks(count = 10) {
  for (let index = 0; index < count; index++) {
    await Promise.resolve();
  }
}

function resetRouteMocks() {
  generateRouteAiComment.mockReset();
  requireOwnerPrincipalAuth.mockReset();
  requireOwnerPrincipalAuth.mockResolvedValue({
    db: { db: "admin" },
    user: { id: "principal-1", email: "user@example.com" },
  });
}

function generationBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    trigger: "user_search",
    reactionGeneration: 0,
    createdAt: generationCreatedAt,
    viewSnapshot,
    ...overrides,
  });
}

async function expectJsonResponse(response: Response, expected: unknown) {
  const body = (await response.json()) as unknown;
  expect(body).toEqual(expected);
}

describe("route AI comment generation route", () => {
  beforeEach(() => {
    resetRouteMocks();
  });

  it("generates a reaction from the supplied viewSnapshot without loading or persisting a route payload row", async () => {
    generateRouteAiComment.mockResolvedValue(reaction);

    const { POST } = await import("../route");
    const request = new Request(reactionGenerateUrl("search-ephemeral-1"), {
      method: "POST",
      body: generationBody(),
    });
    const response = await POST(request, {
      params: Promise.resolve({ id: "search-ephemeral-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Server-Timing")).toContain("parse;dur=");
    expect(response.headers.get("Server-Timing")).toContain("route-auth;dur=");
    expect(response.headers.get("Server-Timing")).not.toContain("load-document;dur=");
    expect(response.headers.get("Server-Timing")).toContain("generate;dur=");
    expect(response.headers.get("Server-Timing")).toContain("total;dur=");
    const serverTiming = response.headers.get("Server-Timing") ?? "";
    expect(serverTiming.indexOf("route-auth;dur=")).toBeLessThan(
      serverTiming.indexOf("parse;dur="),
    );
    expect(requireOwnerPrincipalAuth).toHaveBeenCalledTimes(1);
    const generationParams = generateRouteAiComment.mock.calls[0]?.[0];
    expect(generationParams).toMatchObject({
      ownerPrincipalId: "principal-1",
      userId: "principal-1",
      viewSnapshot,
      trigger: "user_search",
    });
    expect(generationParams.signal).toBeInstanceOf(AbortSignal);
    await expectJsonResponse(response, {
      snapshotId: "search-ephemeral-1",
      snapshotKind: "search",
      reaction,
    });
  });

  it("rejects unauthenticated requests before body read or LLM generation", async () => {
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

    const response = await POST(request, {
      params: Promise.resolve({ id: "search-ephemeral-1" }),
    });

    expect(response.status).toBe(401);
    expect(bodyRead).toBe(false);
    expect(generateRouteAiComment).not.toHaveBeenCalled();
  });

  it("keeps Server-Timing on invalid generation payload responses", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        body: JSON.stringify({ trigger: "" }),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Server-Timing")).toContain("parse;dur=");
    expect(response.headers.get("Server-Timing")).toContain("total;dur=");
    expect(generateRouteAiComment).not.toHaveBeenCalled();
  });

  it("rejects trigger values outside the route AI comment trigger contract", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        body: generationBody({ trigger: "raw user supplied text" }),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );

    expect(response.status).toBe(400);
    expect(generateRouteAiComment).not.toHaveBeenCalled();
  });

  it("rejects generation payloads without a reaction generation", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        body: generationBody({ reactionGeneration: undefined }),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );

    expect(response.status).toBe(400);
    expect(generateRouteAiComment).not.toHaveBeenCalled();
  });

  it("rejects mismatched snapshot targets", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request(reactionGenerateUrl("other-id"), {
        method: "POST",
        body: generationBody(),
      }),
      { params: Promise.resolve({ id: "other-id" }) },
    );

    expect(response.status).toBe(400);
    expect(generateRouteAiComment).not.toHaveBeenCalled();
  });

  it("returns null generation results without persisting them", async () => {
    generateRouteAiComment.mockResolvedValue(null);

    const { POST } = await import("../route");
    const response = await POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        body: generationBody({ reactionGeneration: 2 }),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );

    expect(response.status).toBe(200);
    await expectJsonResponse(response, {
      snapshotId: "search-ephemeral-1",
      snapshotKind: "search",
      reaction: null,
    });
  });

  it("rejects unsupported gap network snapshots on the automatic generation route", async () => {
    const gapSnapshot: ViewSnapshot = {
      snapshotId: "gap-1",
      snapshotKind: "gap_network",
      title: "Gap",
      content: { kind: "gap_network", query: "llm" },
    };

    const { POST } = await import("../route");
    const response = await POST(
      new Request(reactionGenerateUrl("gap-1"), {
        method: "POST",
        body: generationBody({ viewSnapshot: gapSnapshot }),
      }),
      { params: Promise.resolve({ id: "gap-1" }) },
    );

    expect(response.status).toBe(422);
    expect(generateRouteAiComment).not.toHaveBeenCalled();
  });
});

describe("route AI comment generation route in-flight de-dupe", () => {
  beforeEach(() => {
    resetRouteMocks();
  });

  it("deduplicates generation requests for the same ViewSnapshot projection", async () => {
    let resolveGeneration: (value: RouteAiComment) => void = () => {
      throw new Error("Expected a pending generation request");
    };
    generateRouteAiComment.mockReturnValue(
      new Promise<RouteAiComment>((resolve) => {
        resolveGeneration = resolve;
      }),
    );

    const { POST } = await import("../route");
    const firstResponse = POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        body: generationBody(),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );
    await flushRouteMicrotasks();

    const duplicateResponse = POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        body: generationBody({ createdAt: generationCreatedAt + 1 }),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );
    await flushRouteMicrotasks();

    expect(generateRouteAiComment).toHaveBeenCalledTimes(1);
    resolveGeneration(reaction);
    const responses = await Promise.all([firstResponse, duplicateResponse]);

    expect(generateRouteAiComment).toHaveBeenCalledTimes(1);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    await expectJsonResponse(responses[0], {
      snapshotId: "search-ephemeral-1",
      snapshotKind: "search",
      reaction,
    });
    await expectJsonResponse(responses[1], {
      snapshotId: "search-ephemeral-1",
      snapshotKind: "search",
      reaction,
    });
  });

  it("does not deduplicate in-flight generations for different ViewSnapshot projections", async () => {
    const refreshedReaction: RouteAiComment = {
      ...reaction,
      id: "reaction-refreshed",
      body: "보강된 검색 결과의 흐름을 정리했다.",
    };
    const refreshedViewSnapshot: ViewSnapshot = {
      ...viewSnapshot,
      content: {
        ...viewSnapshot.content,
        sort: "interest",
      },
    };
    let resolveFirstGeneration: (value: RouteAiComment) => void = () => {
      throw new Error("Expected a pending first generation request");
    };
    let resolveSecondGeneration: (value: RouteAiComment) => void = () => {
      throw new Error("Expected a pending second generation request");
    };
    generateRouteAiComment
      .mockReturnValueOnce(
        new Promise<RouteAiComment>((resolve) => {
          resolveFirstGeneration = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<RouteAiComment>((resolve) => {
          resolveSecondGeneration = resolve;
        }),
      );

    const { POST } = await import("../route");
    const firstResponse = POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        body: generationBody(),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );
    await vi.waitFor(() => {
      expect(generateRouteAiComment).toHaveBeenCalledTimes(1);
    });

    const refreshedResponse = POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        body: generationBody({ viewSnapshot: refreshedViewSnapshot }),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );
    await vi.waitFor(() => {
      expect(generateRouteAiComment).toHaveBeenCalledTimes(2);
    });

    resolveFirstGeneration(reaction);
    resolveSecondGeneration(refreshedReaction);
    const responses = await Promise.all([firstResponse, refreshedResponse]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    await expectJsonResponse(responses[0], {
      snapshotId: "search-ephemeral-1",
      snapshotKind: "search",
      reaction,
    });
    await expectJsonResponse(responses[1], {
      snapshotId: "search-ephemeral-1",
      snapshotKind: "search",
      reaction: refreshedReaction,
    });
  });

  it("does not return a late successful generation after every duplicate caller aborts", async () => {
    const firstController = new AbortController();
    const duplicateController = new AbortController();
    let generationSignal: AbortSignal | undefined;
    let resolveGeneration: (value: RouteAiComment) => void = () => {
      throw new Error("Expected a pending generation request");
    };
    generateRouteAiComment.mockImplementation((params) => {
      generationSignal = params.signal;
      return new Promise<RouteAiComment>((resolve) => {
        resolveGeneration = resolve;
      });
    });

    const { POST } = await import("../route");
    const firstResponse = POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        signal: firstController.signal,
        body: generationBody(),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );
    await vi.waitFor(() => {
      expect(generateRouteAiComment).toHaveBeenCalledTimes(1);
    });

    const duplicateResponse = POST(
      new Request(reactionGenerateUrl("search-ephemeral-1"), {
        method: "POST",
        signal: duplicateController.signal,
        body: generationBody({ createdAt: generationCreatedAt + 1 }),
      }),
      { params: Promise.resolve({ id: "search-ephemeral-1" }) },
    );
    // The duplicate must be attached to the in-flight entry before the first
    // abort propagates; waiting on its auth call makes that deterministic
    // instead of relying on a fixed microtask count under CI scheduling.
    await vi.waitFor(() => {
      expect(requireOwnerPrincipalAuth).toHaveBeenCalledTimes(2);
    });
    await flushRouteMicrotasks();

    firstController.abort();
    await flushRouteMicrotasks();
    expect(generationSignal?.aborted).toBe(false);

    duplicateController.abort();
    await flushRouteMicrotasks();
    expect(generationSignal?.aborted).toBe(true);

    resolveGeneration(reaction);
    const responses = await Promise.all([firstResponse, duplicateResponse]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    await expectJsonResponse(responses[0], {
      snapshotId: "search-ephemeral-1",
      snapshotKind: "search",
      reaction: null,
    });
    await expectJsonResponse(responses[1], {
      snapshotId: "search-ephemeral-1",
      snapshotKind: "search",
      reaction: null,
    });
  });
});

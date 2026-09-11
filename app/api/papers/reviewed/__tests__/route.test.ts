import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthenticatedError } from "@/app/server/auth/auth-errors";

const {
  listMyReviewedPapers,
  markMyReviewedPaper,
  requireOwnerPrincipalAuth,
  unmarkMyReviewedPaper,
} = vi.hoisted(() => ({
  listMyReviewedPapers: vi.fn(),
  markMyReviewedPaper: vi.fn(),
  requireOwnerPrincipalAuth: vi.fn(),
  unmarkMyReviewedPaper: vi.fn(),
}));

vi.mock("@/app/server/domain-access/reviewed-paper-access", () => ({
  listMyReviewedPapers,
  markMyReviewedPaper,
  unmarkMyReviewedPaper,
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

const authContext = {
  db: {},
  source: "moonlight_scholar",
  user: { id: "principal-1", email: "pilot@example.com" },
} as const;

describe("reviewed paper route ingress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerPrincipalAuth.mockResolvedValue(authContext);
    listMyReviewedPapers.mockResolvedValue([]);
    markMyReviewedPaper.mockResolvedValue(undefined);
    unmarkMyReviewedPaper.mockResolvedValue(undefined);
  });

  it("returns 401 before reading the mutation body or writing the DB", async () => {
    requireOwnerPrincipalAuth.mockRejectedValue(new UnauthenticatedError());
    let bodyRead = false;
    const unreadableRequest = {
      headers: new Headers(),
      get body() {
        bodyRead = true;
        throw new Error("body should not be read");
      },
    } as unknown as Request;
    const { POST } = await import("../route");

    const response = await POST(unreadableRequest);

    expect(response.status).toBe(401);
    expect(bodyRead).toBe(false);
    expect(markMyReviewedPaper).not.toHaveBeenCalled();
  });

  it("rejects oversized writes as 413", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("https://lighthouse.example.com/api/papers/reviewed", {
        method: "POST",
        body: "{}",
        headers: { "content-length": "32769" },
      }),
    );

    expect(response.status).toBe(413);
    expect(markMyReviewedPaper).not.toHaveBeenCalled();
  });

  it("passes the route-resolved auth context into the DB mutation owner", async () => {
    const { POST } = await import("../route");
    const paper = {
      paperId: "paper-1",
      title: "Bounded paper",
      authors: [{ name: "Ada" }],
    };
    const response = await POST(
      new Request("https://lighthouse.example.com/api/papers/reviewed", {
        method: "POST",
        body: JSON.stringify(paper),
      }),
    );

    expect(response.status).toBe(200);
    expect(markMyReviewedPaper).toHaveBeenCalledWith(paper, authContext);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it.each([
    ["missing paper id", {}],
    ["blank paper id", { paperId: " " }],
    ["oversized paper id", { paperId: "p".repeat(257) }],
    ["oversized title", { paperId: "paper-1", title: "t".repeat(2001) }],
    ["oversized URL", { paperId: "paper-1", url: "u".repeat(4097) }],
    [
      "too many authors",
      { paperId: "paper-1", authors: Array.from({ length: 101 }, () => ({ name: "Ada" })) },
    ],
    ["blank author", { paperId: "paper-1", authors: [{ name: " " }] }],
    ["negative citation count", { paperId: "paper-1", citationCount: -1 }],
    ["unknown field", { paperId: "paper-1", unexpected: true }],
  ] as const)("rejects %s before writing", async (_label, payload) => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://lighthouse.example.com/api/papers/reviewed", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "REVIEWED_PAPER_INVALID",
    });
    expect(markMyReviewedPaper).not.toHaveBeenCalled();
  });

  it("lists reviewed papers through the route-resolved auth context", async () => {
    const papers = [{ paperId: "paper-1", title: "Reviewed" }];
    listMyReviewedPapers.mockResolvedValueOnce(papers);
    const { GET } = await import("../route");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(listMyReviewedPapers).toHaveBeenCalledWith(authContext);
    await expect(response.json()).resolves.toEqual(papers);
  });

  it("unmarks one validated paper through the route-resolved auth context", async () => {
    const { DELETE } = await import("../route");

    const response = await DELETE(
      new Request("https://lighthouse.example.com/api/papers/reviewed", {
        method: "DELETE",
        body: JSON.stringify({ paperId: " paper-1 " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(unmarkMyReviewedPaper).toHaveBeenCalledWith("paper-1", authContext);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it.each([{ paperId: "" }, { paperId: "paper-1", unexpected: true }])(
    "rejects an invalid delete payload before writing",
    async (payload) => {
      const { DELETE } = await import("../route");

      const response = await DELETE(
        new Request("https://lighthouse.example.com/api/papers/reviewed", {
          method: "DELETE",
          body: JSON.stringify(payload),
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: "REVIEWED_PAPER_DELETE_INVALID",
      });
      expect(unmarkMyReviewedPaper).not.toHaveBeenCalled();
    },
  );
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOwnerPrincipalAuthMock } = vi.hoisted(() => ({
  requireOwnerPrincipalAuthMock: vi.fn(),
}));

const { listReviewedPapersMock, markAsReviewedMock, unmarkReviewedMock } = vi.hoisted(() => ({
  listReviewedPapersMock: vi.fn(),
  markAsReviewedMock: vi.fn(),
  unmarkReviewedMock: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth: requireOwnerPrincipalAuthMock,
}));

vi.mock("@/app/server/repository/reviewed-papers", () => ({
  listReviewedPapers: listReviewedPapersMock,
  markAsReviewed: markAsReviewedMock,
  unmarkReviewed: unmarkReviewedMock,
}));

describe("reviewed paper access auth boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerPrincipalAuthMock.mockResolvedValue({
      db: { source: "moonlight-admin-db" },
      user: {
        id: "app-user-1",
        email: "pilot@example.com",
      },
    });
  });

  it("lists reviewed papers through owner-principal auth", async () => {
    listReviewedPapersMock.mockResolvedValue([
      {
        id: "reviewed-1",
        userId: "app-user-1",
        paperId: "paper-1",
        title: "Paper 1",
        url: null,
        authors: [],
        year: 2026,
        citationCount: 1,
        reviewedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);

    const { listMyReviewedPapers } = await import("../reviewed-paper-access");
    const result = await listMyReviewedPapers();

    expect(requireOwnerPrincipalAuthMock).toHaveBeenCalledWith();
    expect(listReviewedPapersMock).toHaveBeenCalledWith(
      { source: "moonlight-admin-db" },
      "app-user-1",
    );
    expect(result).toHaveLength(1);
  });

  it("builds a current library context source through the owner principal", async () => {
    listReviewedPapersMock.mockResolvedValue([
      {
        id: "reviewed-1",
        userId: "app-user-1",
        paperId: "123",
        title: "Paper 1",
        url: null,
        authors: [],
        year: 2026,
        citationCount: 1,
        reviewedAt: "2026-06-28T00:00:00.000Z",
      },
    ]);

    const { resolveMyReviewedPapersLibraryContextSource } =
      await import("../reviewed-paper-access");
    const result = await resolveMyReviewedPapersLibraryContextSource();

    expect(requireOwnerPrincipalAuthMock).toHaveBeenCalledWith();
    expect(listReviewedPapersMock).toHaveBeenCalledWith(
      { source: "moonlight-admin-db" },
      "app-user-1",
      { limit: 2_000 },
    );
    expect(result).toEqual({ reviewedPapers: [expect.objectContaining({ paperId: "123" })] });
  });

  it("writes and deletes reviewed paper state through owner-principal auth", async () => {
    const paper = {
      paperId: "paper-1",
      title: "Paper 1",
      authors: [{ name: "Ada" }],
      year: 2026,
      citationCount: 1,
    };

    const { markMyReviewedPaper, unmarkMyReviewedPaper } = await import("../reviewed-paper-access");
    await markMyReviewedPaper(paper);
    await unmarkMyReviewedPaper(paper.paperId);

    expect(markAsReviewedMock).toHaveBeenCalledWith(
      { source: "moonlight-admin-db" },
      "app-user-1",
      paper,
    );
    expect(unmarkReviewedMock).toHaveBeenCalledWith(
      { source: "moonlight-admin-db" },
      "app-user-1",
      paper.paperId,
    );
  });

  it("reads the latest owner rows after a mutation instead of reusing an empty source", async () => {
    const paper = {
      paperId: "paper-1",
      title: "Paper 1",
      authors: [{ name: "Ada" }],
      year: 2026,
      citationCount: 1,
    };
    listReviewedPapersMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...paper, id: "reviewed-1", userId: "app-user-1" }]);
    const { markMyReviewedPaper, resolveMyReviewedPapersLibraryContextSource } =
      await import("../reviewed-paper-access");

    const beforeMutation = await resolveMyReviewedPapersLibraryContextSource();
    await markMyReviewedPaper(paper);
    const afterMutation = await resolveMyReviewedPapersLibraryContextSource();

    expect(beforeMutation.reviewedPapers).toEqual([]);
    expect(afterMutation.reviewedPapers).toHaveLength(1);
    expect(afterMutation.reviewedPapers[0]).toMatchObject({ paperId: "paper-1" });
    expect(listReviewedPapersMock).toHaveBeenCalledTimes(2);
    expect(markAsReviewedMock).toHaveBeenCalledOnce();
  });
});

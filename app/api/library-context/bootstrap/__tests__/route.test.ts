import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnauthenticatedError } from "@/app/server/auth/auth-errors";

const {
  requireOwnerPrincipalAuthMock,
  resolveLibraryContextForUserMock,
  resolveLibraryPresetPapersMock,
  resolveMyReviewedPapersLibraryContextSourceMock,
} = vi.hoisted(() => ({
  requireOwnerPrincipalAuthMock: vi.fn(),
  resolveLibraryContextForUserMock: vi.fn(),
  resolveLibraryPresetPapersMock: vi.fn(),
  resolveMyReviewedPapersLibraryContextSourceMock: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth: requireOwnerPrincipalAuthMock,
}));

vi.mock("@/app/server/domain-access/reviewed-paper-access", () => ({
  resolveMyReviewedPapersLibraryContextSource: resolveMyReviewedPapersLibraryContextSourceMock,
}));

vi.mock("@/app/server/services/library-context-source", () => ({
  resolveLibraryContextForUser: resolveLibraryContextForUserMock,
}));

vi.mock("@/app/server/services/library-anchor-display", () => ({
  resolveLibraryPresetPapers: resolveLibraryPresetPapersMock,
}));

function createBootstrapRequest(signal?: AbortSignal): Request {
  return new Request("http://localhost/api/library-context/bootstrap", { signal });
}

describe("library context bootstrap route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerPrincipalAuthMock.mockResolvedValue({
      db: "db",
      user: { id: "owner-1", email: "reader@example.com" },
    });
    resolveMyReviewedPapersLibraryContextSourceMock.mockResolvedValue({
      reviewedPapers: [{ paperId: "101", title: "Internal Paper" }],
    });
    resolveLibraryContextForUserMock.mockResolvedValue({
      context: {
        folders: [{ name: "내 라이브러리", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-07-08T00:00:00.000Z",
      },
      accessStatus: "available",
    });
    resolveLibraryPresetPapersMock.mockResolvedValue([
      { paperId: "101", title: "Internal Paper", folderName: "내 라이브러리" },
    ]);
  });

  it("returns the authenticated user's library context for post-paint seeding", async () => {
    const { GET, maxDuration } = await import("../route");
    const request = createBootstrapRequest();
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(maxDuration).toBe(120);
    expect(resolveMyReviewedPapersLibraryContextSourceMock).toHaveBeenCalledWith();
    expect(resolveLibraryContextForUserMock).toHaveBeenCalledWith(
      "reader@example.com",
      {
        reviewedPapers: [{ paperId: "101", title: "Internal Paper" }],
      },
      { signal: request.signal },
    );
    expect(resolveLibraryPresetPapersMock).toHaveBeenCalledWith(
      {
        folders: [{ name: "내 라이브러리", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-07-08T00:00:00.000Z",
      },
      { signal: request.signal },
    );
    expect(await response.json()).toEqual({
      userEmail: "reader@example.com",
      libraryContextAvailable: true,
      libraryAccessStatus: "available",
      libraryPapers: [{ paperId: "101", title: "Internal Paper", folderName: "내 라이브러리" }],
    });
  });

  it("stops bootstrap work when the client request is already aborted", async () => {
    const controller = new AbortController();
    const request = createBootstrapRequest(controller.signal);
    controller.abort();

    const { GET } = await import("../route");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userEmail: "reader@example.com",
      libraryContextAvailable: false,
      libraryAccessStatus: "unavailable",
      libraryPapers: [],
    });
    expect(resolveMyReviewedPapersLibraryContextSourceMock).not.toHaveBeenCalled();
    expect(resolveLibraryContextForUserMock).not.toHaveBeenCalled();
    expect(resolveLibraryPresetPapersMock).not.toHaveBeenCalled();
  });

  it("degrades library source failures without blocking the research shell", async () => {
    resolveMyReviewedPapersLibraryContextSourceMock.mockRejectedValue(new Error("db unavailable"));

    const { GET } = await import("../route");
    const response = await GET(createBootstrapRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userEmail: "reader@example.com",
      libraryContextAvailable: false,
      libraryAccessStatus: "unavailable",
      libraryPapers: [],
    });
  });

  it("keeps authentication failures as route-guard failures", async () => {
    requireOwnerPrincipalAuthMock.mockRejectedValue(new UnauthenticatedError());

    const { GET } = await import("../route");
    const response = await GET(createBootstrapRequest());

    expect(response.status).toBe(401);
    expect(resolveMyReviewedPapersLibraryContextSourceMock).not.toHaveBeenCalled();
  });
});

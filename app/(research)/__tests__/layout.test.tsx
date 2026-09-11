import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import ResearchLayout from "@/app/(research)/layout";

const {
  resolveLibraryContextForUserMock,
  resolveLibraryPresetPapersMock,
  resolveMyReviewedPapersLibraryContextSourceMock,
} = vi.hoisted(() => ({
  resolveLibraryContextForUserMock: vi.fn(),
  resolveLibraryPresetPapersMock: vi.fn(),
  resolveMyReviewedPapersLibraryContextSourceMock: vi.fn(),
}));

vi.mock("@/app/server/services/library-context-source", () => ({
  resolveLibraryContextForUser: resolveLibraryContextForUserMock,
}));

vi.mock("@/app/server/domain-access/reviewed-paper-access", () => ({
  resolveMyReviewedPapersLibraryContextSource: resolveMyReviewedPapersLibraryContextSourceMock,
}));

vi.mock("@/app/server/services/library-anchor-display", () => ({
  resolveLibraryPresetPapers: resolveLibraryPresetPapersMock,
}));

vi.mock("@/app/components/MoonlightAuthBootstrap", () => ({
  MoonlightAuthBootstrap: ({ fallback }: { readonly fallback: string }) => (
    <div data-testid="moonlight-auth-bootstrap" data-fallback={fallback} />
  ),
}));

vi.mock("@/app/(research)/research-route-shell", () => ({
  ResearchRouteShell: ({
    children,
    userEmail,
    libraryContextAvailable = false,
    libraryAccessStatus = "unavailable",
  }: {
    readonly children: ReactNode;
    readonly userEmail?: string;
    readonly libraryContextAvailable?: boolean;
    readonly libraryAccessStatus?: string;
  }) => (
    <section
      data-testid="research-route-shell"
      data-user-email={userEmail}
      data-library-context-available={String(libraryContextAvailable)}
      data-library-access-status={libraryAccessStatus}
    >
      {children}
    </section>
  ),
}));

describe("research layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveMyReviewedPapersLibraryContextSourceMock.mockResolvedValue({
      reviewedPapers: [],
    });
    resolveLibraryContextForUserMock.mockResolvedValue({
      context: null,
      accessStatus: "unavailable",
    });
    resolveLibraryPresetPapersMock.mockResolvedValue([]);
  });

  it("renders the search-first research shell without server auth gating", () => {
    const markup = renderToStaticMarkup(
      ResearchLayout({ children: <div data-testid="route-children" /> }),
    );

    // Search-first: server gate로 first paint를 막지 않고 검색 entry shell을 먼저 렌더한다.
    // post-paint bootstrap 401의 auth 전환은 client shell evidence가 별도로 잠근다.
    expect(markup).toContain('data-testid="research-route-shell"');
    expect(markup).toContain('data-testid="route-children"');
    expect(markup).not.toContain('data-testid="moonlight-auth-bootstrap"');
    expect(markup).not.toContain('data-user-email="');
    expect(resolveMyReviewedPapersLibraryContextSourceMock).not.toHaveBeenCalled();
    expect(resolveLibraryContextForUserMock).not.toHaveBeenCalled();
    expect(resolveLibraryPresetPapersMock).not.toHaveBeenCalled();
  });

  it("does not put user resolution on the layout first-paint path", () => {
    const markup = renderToStaticMarkup(
      ResearchLayout({ children: <div data-testid="route-children" /> }),
    );

    expect(markup).toContain('data-testid="research-route-shell"');
    expect(markup).not.toContain('data-user-email="');
    expect(markup).toContain('data-testid="route-children"');
    expect(markup).not.toContain('data-testid="moonlight-auth-bootstrap"');
    expect(resolveMyReviewedPapersLibraryContextSourceMock).not.toHaveBeenCalled();
    expect(resolveLibraryContextForUserMock).not.toHaveBeenCalled();
    expect(resolveLibraryPresetPapersMock).not.toHaveBeenCalled();
  });

  it("does not put library source failures on the layout first-paint path", () => {
    resolveMyReviewedPapersLibraryContextSourceMock.mockRejectedValue(new Error("db unavailable"));

    const markup = renderToStaticMarkup(
      ResearchLayout({ children: <div data-testid="route-children" /> }),
    );

    expect(markup).toContain('data-testid="research-route-shell"');
    expect(markup).toContain('data-library-context-available="false"');
    expect(markup).toContain('data-library-access-status="unavailable"');
    expect(markup).toContain('data-testid="route-children"');
    expect(resolveMyReviewedPapersLibraryContextSourceMock).not.toHaveBeenCalled();
    expect(resolveLibraryContextForUserMock).not.toHaveBeenCalled();
    expect(resolveLibraryPresetPapersMock).not.toHaveBeenCalled();
  });
});

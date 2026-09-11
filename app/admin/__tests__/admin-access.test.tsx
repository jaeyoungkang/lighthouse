import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminAccessPage from "@/app/(admin)/admin/access/page";
import AnalyticsEventsPage from "@/app/(admin)/admin/analytics/page";
import { addInvitedAccess, removeInvitedAccess } from "@/app/(admin)/admin/access/actions";
import { ForbiddenError } from "@/app/server/auth/auth-errors";
import {
  requireInternalAdminAuth,
  requireInternalAdminUser,
} from "@/app/server/auth/internal-admin";
import {
  listInvitedAccessForAdmin,
  updateInvitedAccessMembershipForAdmin,
} from "@/app/server/domain-access/access-allowlist-access";
import { trackAdminInvitedAccessMembershipSynced } from "@/app/server/domain-access/server-analytics";
import { redirect } from "next/navigation";

const CURSOR_CURRENT = "11111111-1111-4111-8111-111111111111";
const CURSOR_PREVIOUS = "22222222-2222-4222-8222-222222222222";
const CURSOR_NEXT = "33333333-3333-4333-8333-333333333333";

const defaultAccessPage = {
  entries: [
    {
      cursor: CURSOR_CURRENT,
      email: "pilot@example.com",
      updatedAt: "2026-07-26T12:00:00.000Z",
      updatedBy: "admin@corca.ai",
    },
  ],
  previousCursor: null,
  nextCursor: null,
};

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/app/server/auth/internal-admin", () => ({
  requireInternalAdminAuth: vi.fn(() =>
    Promise.resolve({
      db: {},
      source: "supabase",
      user: { id: "admin-1", email: "admin@corca.ai" },
    }),
  ),
  requireInternalAdminUser: vi.fn(() =>
    Promise.resolve({ id: "admin-1", email: "admin@corca.ai" }),
  ),
}));

vi.mock("@/app/server/domain-access/access-allowlist-access", () => ({
  listInvitedAccessForAdmin: vi.fn(() => Promise.resolve(defaultAccessPage)),
  updateInvitedAccessMembershipForAdmin: vi.fn(() => Promise.resolve("pilot@example.com")),
}));

vi.mock("@/app/server/domain-access/server-analytics", () => ({
  trackAdminInvitedAccessMembershipSynced: vi.fn(() => Promise.resolve()),
}));

vi.mock("next/navigation", () => ({
  notFound: navigationMocks.notFound,
  redirect: navigationMocks.redirect,
}));

describe("admin route access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireInternalAdminAuth).mockResolvedValue({
      db: {} as never,
      source: "supabase",
      user: { id: "admin-1", email: "admin@corca.ai" },
    });
    vi.mocked(requireInternalAdminUser).mockResolvedValue({
      id: "admin-1",
      email: "admin@corca.ai",
    });
    vi.mocked(updateInvitedAccessMembershipForAdmin).mockResolvedValue("pilot@example.com");
    vi.mocked(trackAdminInvitedAccessMembershipSynced).mockResolvedValue(undefined);
    vi.mocked(listInvitedAccessForAdmin).mockResolvedValue(defaultAccessPage);
  });

  it("guards the retained analytics admin page with the internal admin gate", async () => {
    await AnalyticsEventsPage();
    expect(requireInternalAdminUser).toHaveBeenCalledTimes(1);
  }, 90000);

  it("guards and renders the invited-access management surface", async () => {
    const markup = renderToStaticMarkup(
      await AdminAccessPage({ searchParams: Promise.resolve({ status: "added" }) }),
    );

    expect(requireInternalAdminAuth).toHaveBeenCalledTimes(1);
    expect(listInvitedAccessForAdmin).toHaveBeenCalledWith(expect.any(Object), {
      cursor: undefined,
      direction: "after",
    });
    expect(markup).toContain("초대 사용자 접속 관리");
    expect(markup).toContain("pilot@example.com");
    expect(markup).toContain("외부 이메일의 접속을 허용했습니다.");
    expect(markup).toContain('data-testid="admin-access-footer"');
    expect(markup).toContain('href="/admin/analytics"');
  });

  it("renders opaque keyset navigation without putting invited email in links", async () => {
    vi.mocked(listInvitedAccessForAdmin).mockResolvedValueOnce({
      ...defaultAccessPage,
      previousCursor: CURSOR_PREVIOUS,
      nextCursor: CURSOR_NEXT,
    });

    const markup = renderToStaticMarkup(
      await AdminAccessPage({
        searchParams: Promise.resolve({ cursor: CURSOR_CURRENT, direction: "before" }),
      }),
    );

    expect(listInvitedAccessForAdmin).toHaveBeenCalledWith(expect.any(Object), {
      cursor: CURSOR_CURRENT,
      direction: "before",
    });
    expect(markup).toContain(`cursor=${CURSOR_PREVIOUS}&amp;direction=before`);
    expect(markup).toContain(`cursor=${CURSOR_NEXT}`);
    expect(markup).toContain('href="/admin/access?direction=before"');
    expect(markup).not.toMatch(/href="[^"]*pilot(?:%40|@)example\.com/);
  });

  it("resets a malformed cursor to the first page before the admin repository boundary", async () => {
    await AdminAccessPage({
      searchParams: Promise.resolve({ cursor: "pilot@example.com", direction: "before" }),
    });

    expect(listInvitedAccessForAdmin).toHaveBeenCalledWith(expect.any(Object), {
      cursor: undefined,
      direction: "after",
    });
  });

  it("keeps recovery navigation visible when concurrent deletion empties a cursor page", async () => {
    vi.mocked(listInvitedAccessForAdmin).mockResolvedValueOnce({
      entries: [],
      previousCursor: CURSOR_CURRENT,
      nextCursor: null,
    });

    const markup = renderToStaticMarkup(
      await AdminAccessPage({
        searchParams: Promise.resolve({ cursor: CURSOR_CURRENT }),
      }),
    );

    expect(markup).toContain(
      "현재 페이지에 표시할 외부 이메일이 없습니다. 페이지 이동으로 목록을 계속 확인하세요.",
    );
    expect(markup).not.toContain("현재 접속 가능한 외부 이메일이 없습니다.");
    expect(markup).toContain('href="/admin/access"');
    expect(markup).toContain(`cursor=${CURSOR_CURRENT}&amp;direction=before`);
  });

  it("keeps the global empty copy and hides pagination when the allowlist has no rows", async () => {
    vi.mocked(listInvitedAccessForAdmin).mockResolvedValueOnce({
      entries: [],
      previousCursor: null,
      nextCursor: null,
    });

    const markup = renderToStaticMarkup(
      await AdminAccessPage({ searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain("현재 접속 가능한 외부 이메일이 없습니다.");
    expect(markup).not.toContain("현재 페이지에 표시할 외부 이메일이 없습니다.");
    expect(markup).not.toContain('aria-label="초대 이메일 목록 페이지"');
  });

  it("keeps next-page recovery visible when a backward cursor page becomes empty", async () => {
    vi.mocked(listInvitedAccessForAdmin).mockResolvedValueOnce({
      entries: [],
      previousCursor: null,
      nextCursor: CURSOR_CURRENT,
    });

    const markup = renderToStaticMarkup(
      await AdminAccessPage({
        searchParams: Promise.resolve({ cursor: CURSOR_CURRENT, direction: "before" }),
      }),
    );

    expect(markup).toContain("현재 페이지에 표시할 외부 이메일이 없습니다.");
    expect(markup).toContain(`href="/admin/access?cursor=${CURSOR_CURRENT}"`);
  });

  it("closes the admin page as not-found for an external user", async () => {
    vi.mocked(requireInternalAdminAuth).mockRejectedValueOnce(new ForbiddenError());
    navigationMocks.notFound.mockImplementationOnce(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(AdminAccessPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(listInvitedAccessForAdmin).not.toHaveBeenCalled();
  });

  it("adds membership before reporting success", async () => {
    const formData = new FormData();
    formData.set("email", " Pilot@Example.com ");

    await expect(addInvitedAccess(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/admin/access?status=added",
    );
    const [mutationAuth, mutationInput] = vi.mocked(updateInvitedAccessMembershipForAdmin).mock
      .calls[0];
    expect(mutationAuth.user.email).toBe("admin@corca.ai");
    expect(mutationInput).toEqual({
      email: "pilot@example.com",
      operation: "add",
    });
    expect(trackAdminInvitedAccessMembershipSynced).toHaveBeenCalledWith("admin-1", "add");
  });

  it("removes membership before reporting success", async () => {
    const formData = new FormData();
    formData.set("email", "pilot@example.com");

    await expect(removeInvitedAccess(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/admin/access?status=removed",
    );
    expect(updateInvitedAccessMembershipForAdmin).toHaveBeenCalledWith(expect.any(Object), {
      email: "pilot@example.com",
      operation: "remove",
    });
    expect(trackAdminInvitedAccessMembershipSynced).toHaveBeenCalledWith("admin-1", "remove");
  });

  it("preserves the previous state and reports a write failure", async () => {
    vi.mocked(updateInvitedAccessMembershipForAdmin).mockRejectedValueOnce(
      new Error("write failed"),
    );
    const formData = new FormData();
    formData.set("email", "pilot@example.com");

    await expect(addInvitedAccess(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/admin/access?status=failed",
    );
    expect(trackAdminInvitedAccessMembershipSynced).not.toHaveBeenCalled();
  });

  it("rejects malformed or internal email input before mutation", async () => {
    for (const email of ["member@corca.ai", "invalid"]) {
      const formData = new FormData();
      formData.set("email", email);

      await expect(addInvitedAccess(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/admin/access?status=invalid",
      );
    }

    expect(updateInvitedAccessMembershipForAdmin).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/admin/access?status=invalid");
  });

  it("does not report a zero membership count when the list read fails", async () => {
    vi.mocked(listInvitedAccessForAdmin).mockRejectedValueOnce(new Error("read failed"));

    const markup = renderToStaticMarkup(
      await AdminAccessPage({ searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain("현재 접속 이메일을 불러오지 못했습니다.");
    expect(markup).not.toContain("현재 페이지 0개");
  });
});

import { describe, expect, it, vi } from "vitest";
import { isInternalAdminEmail, requireInternalAdminAuth } from "@/app/server/auth/internal-admin";
import { ForbiddenError } from "@/app/server/auth/auth-errors";

const requireOwnerPrincipalAuth = vi.hoisted(() => vi.fn());

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

describe("internal-admin", () => {
  it("treats @corca.ai emails as internal admins", () => {
    expect(isInternalAdminEmail(" Admin@Corca.AI ")).toBe(true);
    expect(isInternalAdminEmail("admin@example.com")).toBe(false);
    expect(isInternalAdminEmail("external@example.com@corca.ai")).toBe(false);
  });

  it("returns the authenticated repository handle only for an internal admin", async () => {
    requireOwnerPrincipalAuth.mockResolvedValueOnce({
      db: { source: "owner-db" },
      user: { id: "admin-1", email: "admin@corca.ai" },
    });

    await expect(requireInternalAdminAuth()).resolves.toEqual({
      db: { source: "owner-db" },
      user: { id: "admin-1", email: "admin@corca.ai" },
    });

    requireOwnerPrincipalAuth.mockResolvedValueOnce({
      db: { source: "owner-db" },
      user: { id: "user-1", email: "reader@example.com" },
    });
    await expect(requireInternalAdminAuth()).rejects.toBeInstanceOf(ForbiddenError);

    requireOwnerPrincipalAuth.mockResolvedValueOnce({
      db: { source: "owner-db" },
      user: { id: "user-2", email: "external@example.com@corca.ai" },
    });
    await expect(requireInternalAdminAuth()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

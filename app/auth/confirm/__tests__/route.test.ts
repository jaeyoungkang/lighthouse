import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.fn();

vi.mock("@/app/server/auth/supabase", () => ({
  createClient: createClientMock,
}));

describe("auth confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("verifies token_hash links before falling back to legacy code exchange", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    const exchangeCodeForSession = vi.fn();

    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession,
        verifyOtp,
      },
    });

    const { GET } = await import("../route");
    const response = await GET(
      new NextRequest("https://example.com/auth/confirm?token_hash=hash-123&type=magiclink"),
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-123",
      type: "magiclink",
    });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://example.com/");
  });

  it("keeps the legacy code exchange flow working", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession,
        verifyOtp: vi.fn(),
      },
    });

    const { GET } = await import("../route");
    const response = await GET(
      new NextRequest("https://example.com/auth/confirm?code=code-123&next=%2Fsearch"),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("code-123");
    expect(response.headers.get("location")).toBe("https://example.com/search");
  });

  it("keeps successful next redirects on the request origin", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession,
        verifyOtp: vi.fn(),
      },
    });

    const { GET } = await import("../route");
    const response = await GET(
      new NextRequest(
        "https://example.com/auth/confirm?code=code-123&next=%2F%2Fevil.example%2Fsteal",
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("code-123");
    expect(response.headers.get("location")).toBe("https://example.com/");
  });

  it("redirects to auth=failed when verification and exchange both fail", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      error: { message: "invalid token" },
    });
    const exchangeCodeForSession = vi.fn().mockResolvedValue({
      error: { message: "missing verifier" },
    });

    createClientMock.mockResolvedValue({
      auth: {
        exchangeCodeForSession,
        verifyOtp,
      },
    });

    const { GET } = await import("../route");
    const response = await GET(
      new NextRequest(
        "https://example.com/auth/confirm?token_hash=hash-123&type=magiclink&code=code-123",
      ),
    );

    expect(verifyOtp).toHaveBeenCalledOnce();
    expect(exchangeCodeForSession).toHaveBeenCalledWith("code-123");
    expect(response.headers.get("location")).toBe("https://example.com/?auth=failed");
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

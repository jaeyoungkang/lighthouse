import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestErrorMessage, requestMagicLink } from "@/app/lib/auth/request-magic-link";

describe("request-magic-link", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests a magic link through the server auth route", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(requestMagicLink("researcher@corca.ai")).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith("/api/auth/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "researcher@corca.ai" }),
    });
  });

  it("throws the server error message when the request fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "For security purposes, you can only request this after 51 seconds.",
        }),
        { status: 429 },
      ),
    );

    await expect(requestMagicLink("researcher@corca.ai")).rejects.toThrow(
      "For security purposes, you can only request this after 51 seconds.",
    );
  });

  it("normalizes thrown errors into a user-facing message", () => {
    expect(getRequestErrorMessage(new Error("인증 메일 전송 중 오류가 발생했습니다"))).toBe(
      "인증 메일 전송 중 오류가 발생했습니다",
    );
    expect(getRequestErrorMessage(null)).toBe("네트워크 오류가 발생했습니다");
  });
});

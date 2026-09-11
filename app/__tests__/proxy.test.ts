import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MOONLIGHT_SCHOLAR_LOCAL_SESSION_COOKIE,
  MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES,
} from "@/app/server/auth/moonlight-scholar-session-cookie";

type SupabaseGetUserMock = () => Promise<unknown>;
type CreateServerClientMock = (
  url: string,
  anonKey: string,
  options: { readonly cookies: unknown },
) => { readonly auth: { readonly getUser: SupabaseGetUserMock } };

const { createServerClientMock, getUserMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn<CreateServerClientMock>(),
  getUserMock: vi.fn<SupabaseGetUserMock>(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

describe("proxy auth hot path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([...MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES])(
    "does not call Supabase Auth when %s is already present",
    async (cookieName) => {
      const response = await runProxy(
        new NextRequest("https://lighthouse.example.com/search", {
          headers: {
            cookie: `${cookieName}=moonlight-session-token`,
          },
        }),
      );

      expect(response.status).toBe(200);
      expect(createServerClientMock).not.toHaveBeenCalled();
      expect(getUserMock).not.toHaveBeenCalled();
    },
  );

  it("does not call Supabase Auth when no auth session cookies exist", async () => {
    const response = await runProxy(new NextRequest("https://lighthouse.example.com/search"));

    expect(response.status).toBe(200);
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it.each([
    "/",
    "/api/auth/magic-link",
    "/api/auth/session-touch",
    "/api/analytics-events",
    "/api/errors",
  ])("does not refresh Supabase Auth before public hot path %s", async (path) => {
    const response = await runProxy(
      new NextRequest(`https://lighthouse.example.com${path}`, {
        headers: {
          cookie: "sb-local-auth-token=supabase-session",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("keeps the Supabase refresh path when a Supabase auth session cookie exists", async () => {
    const response = await runProxy(
      new NextRequest("https://lighthouse.example.com/search", {
        headers: {
          cookie: "sb-local-auth-token=supabase-session",
        },
      }),
    );
    const call = createServerClientMock.mock.calls[0];

    expect(response.status).toBe(200);
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(call[0]).toBe("https://supabase.example.com");
    expect(call[1]).toBe("anon-key");
    expect(call[2]).toHaveProperty("cookies");
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });

  it("clears stale Supabase auth cookies when the refresh token is gone", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { code: "refresh_token_not_found" },
    });

    const response = await runProxy(
      new NextRequest("https://lighthouse.example.com/search", {
        headers: {
          cookie:
            "sb-local-auth-token=stale; sb-local-auth-token.0=stale-part; sb-local-auth-token-code-verifier=keep",
        },
      }),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";
    const forwardedCookie = response.headers.get("x-middleware-request-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(setCookie).toContain("sb-local-auth-token=");
    expect(setCookie).toContain("sb-local-auth-token.0=");
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(setCookie).not.toContain("sb-local-auth-token-code-verifier");
    expect(forwardedCookie).not.toContain("sb-local-auth-token=stale");
    expect(forwardedCookie).not.toContain("sb-local-auth-token.0=stale-part");
    expect(forwardedCookie).toContain("sb-local-auth-token-code-verifier=keep");
  });

  it("also clears stale Supabase auth cookies when the client rejects", async () => {
    getUserMock.mockRejectedValue({ code: "refresh_token_not_found" });

    const response = await runProxy(
      new NextRequest("https://lighthouse.example.com/search", {
        headers: {
          cookie: "sb-local-auth-token=stale; sb-local-auth-token-code-verifier=keep",
        },
      }),
    );
    const setCookie = response.headers.get("set-cookie") ?? "";
    const forwardedCookie = response.headers.get("x-middleware-request-cookie") ?? "";

    expect(setCookie).toContain("sb-local-auth-token=");
    expect(setCookie).not.toContain("sb-local-auth-token-code-verifier");
    expect(forwardedCookie).not.toContain("sb-local-auth-token=stale");
    expect(forwardedCookie).toContain("sb-local-auth-token-code-verifier=keep");
  });

  it("keeps unexpected Supabase auth failures observable", async () => {
    const error = new Error("supabase auth unavailable");
    getUserMock.mockRejectedValue(error);

    await expect(
      runProxy(
        new NextRequest("https://lighthouse.example.com/search", {
          headers: {
            cookie: "sb-local-auth-token=supabase-session",
          },
        }),
      ),
    ).rejects.toBe(error);
  });

  it("does not treat the future local-session cookie as a current verified session", async () => {
    const response = await runProxy(
      new NextRequest("https://lighthouse.example.com/search", {
        headers: {
          cookie: `${MOONLIGHT_SCHOLAR_LOCAL_SESSION_COOKIE}=local-signed-cookie; sb-local-auth-token=supabase-session`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(getUserMock).toHaveBeenCalledTimes(1);
  });

  it("redirects auth confirmation codes before any session refresh", async () => {
    const response = await runProxy(
      new NextRequest("https://lighthouse.example.com/?code=abc123&next=%2Fsearch", {
        headers: {
          cookie: `${MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES[0]}=moonlight-session-token`,
        },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://lighthouse.example.com/auth/confirm?code=abc123&next=%2Fsearch",
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
  });
});

async function runProxy(request: NextRequest): Promise<Response> {
  const { proxy } = await import("../../proxy");
  return proxy(request);
}

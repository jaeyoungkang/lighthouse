import { describe, expect, it } from "vitest";
import {
  buildAppRedirectUrl,
  buildAuthConfirmRedirectUrl,
  buildEmailRedirectUrl,
  getAuthEmailRestrictionMessage,
  getLocalAuthInboxUrl,
  hasSupabaseAuthSessionCookie,
  isLocalSupabaseUrl,
  isRefreshTokenNotFoundError,
  listSupabaseAuthCookieNames,
} from "@/app/lib/supabase/auth-helpers";

describe("supabase auth helpers", () => {
  it("detects local Supabase URLs", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://example.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl("not-a-url")).toBe(false);
    expect(isLocalSupabaseUrl(undefined)).toBe(false);
  });

  it("returns environment-specific email guidance and inbox URL", () => {
    expect(getAuthEmailRestrictionMessage("http://127.0.0.1:54321")).toContain("아무 이메일이나");
    expect(getAuthEmailRestrictionMessage("https://project.supabase.co")).toContain(
      "초대된 이메일",
    );
    expect(getLocalAuthInboxUrl("http://localhost:54321")).toBe("http://127.0.0.1:54324");
    expect(getLocalAuthInboxUrl("https://project.supabase.co")).toBeNull();
  });

  it("builds the magic link redirect URL without OTP query parameters", () => {
    expect(buildEmailRedirectUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/confirm",
    );
    expect(buildEmailRedirectUrl("http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000/auth/confirm",
    );
    expect(buildEmailRedirectUrl("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/confirm",
    );
    expect(buildEmailRedirectUrl("not-a-url")).toBe("not-a-url/auth/confirm");
  });

  it("builds magic link redirects from the request host when the server bind address differs", () => {
    expect(buildEmailRedirectUrl("http://0.0.0.0:3002/api/auth/magic-link", "localhost:3002")).toBe(
      "http://localhost:3002/auth/confirm",
    );
    expect(
      buildEmailRedirectUrl("http://127.0.0.1:3002/api/auth/magic-link", "localhost:3002", "https"),
    ).toBe("https://localhost:3002/auth/confirm");
    expect(
      buildEmailRedirectUrl(
        "http://internal:3000/api/auth/magic-link",
        "lighthouse.example.com",
        "https",
      ),
    ).toBe("https://lighthouse.example.com/auth/confirm");
    expect(
      buildEmailRedirectUrl(
        "https://internal:3000/api/auth/magic-link",
        "lighthouse.example.com",
        "ftp",
      ),
    ).toBe("https://lighthouse.example.com/auth/confirm");
    expect(
      buildEmailRedirectUrl(
        "http://internal:3000/api/auth/magic-link",
        "lighthouse.example.com",
        "HTTPS",
      ),
    ).toBe("https://lighthouse.example.com/auth/confirm");
    expect(
      buildEmailRedirectUrl(
        "http://internal:3000/api/auth/magic-link",
        "lighthouse.example.com",
        "https,http",
      ),
    ).toBe("https://lighthouse.example.com/auth/confirm");
  });

  it("redirects auth codes on non-confirm routes to the confirm route", () => {
    expect(buildAuthConfirmRedirectUrl("http://127.0.0.1:3000/?code=abc123")).toBe(
      "http://127.0.0.1:3000/auth/confirm?code=abc123",
    );
    expect(
      buildAuthConfirmRedirectUrl("http://127.0.0.1:3000/auth/confirm?code=abc123&next=%2F"),
    ).toBeNull();
    expect(buildAuthConfirmRedirectUrl("http://127.0.0.1:3000/")).toBeNull();
    expect(buildAuthConfirmRedirectUrl("not-a-url")).toBeNull();
  });

  it("builds app redirects from the actual request host instead of the bind address", () => {
    expect(
      buildAppRedirectUrl("http://0.0.0.0:3000/auth/confirm?code=abc123", "/", "127.0.0.1:3000"),
    ).toBe("http://127.0.0.1:3000/");
    expect(
      buildAppRedirectUrl(
        "http://0.0.0.0:3000/auth/confirm?code=abc123",
        "/?auth=failed",
        "localhost:3000",
        "https",
      ),
    ).toBe("https://localhost:3000/?auth=failed");
    expect(buildAppRedirectUrl("not-a-url", "dashboard")).toBe("/");
  });

  it("keeps app redirects on the normalized request origin", () => {
    expect(
      buildAppRedirectUrl(
        "http://internal:3000/auth/confirm?code=abc123",
        "/search?q=graph#results",
        "lighthouse.example.com",
        "https",
      ),
    ).toBe("https://lighthouse.example.com/search?q=graph#results");

    expect(buildAppRedirectUrl("https://example.com/auth/confirm", "//evil.example/path")).toBe(
      "https://example.com/",
    );
    expect(buildAppRedirectUrl("https://example.com/auth/confirm", "/\\evil.example/path")).toBe(
      "https://example.com/",
    );
    expect(
      buildAppRedirectUrl("https://example.com/auth/confirm", "https://evil.example/path"),
    ).toBe("https://example.com/");
    expect(buildAppRedirectUrl("https://example.com/auth/confirm", "dashboard")).toBe(
      "https://example.com/",
    );
    expect(
      buildAppRedirectUrl("https://example.com/auth/confirm", "https://example.com/dashboard"),
    ).toBe("https://example.com/");
    expect(
      buildAppRedirectUrl("https://example.com/auth/confirm", "/search", "example.com", "ftp"),
    ).toBe("https://example.com/search");
    expect(
      buildAppRedirectUrl(
        "http://internal:3000/auth/confirm",
        "/search",
        "lighthouse.example.com",
        "HTTPS",
      ),
    ).toBe("https://lighthouse.example.com/search");
    expect(buildAppRedirectUrl("not-a-url", "//evil.example/path")).toBe("/");
  });

  it("finds Supabase auth cookies and recognizes refresh-token errors", () => {
    expect(
      listSupabaseAuthCookieNames([
        { name: "sb-abc-auth-token" },
        { name: "sb-abc-auth-token.0" },
        { name: "sb-abc-auth-token-code-verifier" },
        { name: "sb-abc-auth-token-code-verifier.0" },
        { name: "other-cookie" },
      ]),
    ).toEqual(["sb-abc-auth-token", "sb-abc-auth-token.0"]);
    expect(
      hasSupabaseAuthSessionCookie([
        { name: "sb-abc-auth-token" },
        { name: "sb-abc-auth-token-code-verifier" },
      ]),
    ).toBe(true);
    expect(
      hasSupabaseAuthSessionCookie([
        { name: "sb-abc-auth-token-code-verifier" },
        { name: "other-cookie" },
      ]),
    ).toBe(false);

    expect(isRefreshTokenNotFoundError({ code: "refresh_token_not_found" })).toBe(true);
    expect(isRefreshTokenNotFoundError({ code: "other_error" })).toBe(false);
    expect(isRefreshTokenNotFoundError(null)).toBe(false);
  });
});

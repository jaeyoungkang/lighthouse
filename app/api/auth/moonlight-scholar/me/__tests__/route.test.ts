import { NextRequest } from "next/server";
import * as jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jwtSecret = "local-moonlight-scholar-secret";

type AuthMeResponseBody =
  | {
      readonly ok: true;
      readonly user: {
        readonly id: string;
        readonly email: string;
        readonly plan?: string;
        readonly isAdmin?: boolean;
      };
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
      readonly code: string;
      readonly action: string;
      readonly retryable: boolean;
    };

describe("Moonlight Scholar auth canary route", () => {
  beforeEach(() => {
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET", jwtSecret);
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER", "moonlight");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE", "moonlight-scholar");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the Moonlight Scholar token subject and claims", async () => {
    const response = await requestWithToken(signMoonlightScholarToken());
    const body = (await response.json()) as AuthMeResponseBody;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      user: {
        id: "moonlight-user-1",
        email: "pilot@example.com",
        plan: "pro",
        isAdmin: true,
      },
    });
  });

  it("requires a Bearer token", async () => {
    const { GET } = await import("../route");
    const response = await GET(
      new NextRequest("https://lighthouse.example.com/api/auth/moonlight-scholar/me"),
    );
    const body = (await response.json()) as AuthMeResponseBody;

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "MOONLIGHT_SCHOLAR_TOKEN_MISSING",
        message: "Moonlight Scholar bearer token required.",
      },
      code: "MOONLIGHT_SCHOLAR_TOKEN_MISSING",
      action: "authenticate",
      retryable: false,
    });
  });

  it("rejects a token with the wrong audience", async () => {
    const response = await requestWithToken(signMoonlightScholarToken({ audience: "moonlight" }));
    const body = (await response.json()) as AuthMeResponseBody;

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      error: {
        code: "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
        message: "Moonlight Scholar token invalid.",
      },
      code: "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
      action: "authenticate",
      retryable: false,
    });
  });

  it("rejects an expired token", async () => {
    const response = await requestWithToken(signMoonlightScholarToken({ expiresIn: -1 }));
    const body = (await response.json()) as AuthMeResponseBody;

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      code: "MOONLIGHT_SCHOLAR_TOKEN_EXPIRED",
      action: "authenticate",
      retryable: false,
    });
  });

  it("accepts a target-valid token without optional plan or admin claims", async () => {
    const response = await requestWithToken(signMoonlightScholarToken({ optionalClaims: false }));
    const body = (await response.json()) as AuthMeResponseBody;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      user: {
        id: "moonlight-user-1",
        email: "pilot@example.com",
      },
    });
  });

  it("returns normalized token subject and optional string claims", async () => {
    const response = await requestWithToken(
      signMoonlightScholarToken({
        email: " pilot@example.com ",
        plan: " pro ",
        subject: " moonlight-user-1 ",
      }),
    );
    const body = (await response.json()) as AuthMeResponseBody;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      user: {
        id: "moonlight-user-1",
        email: "pilot@example.com",
        plan: "pro",
        isAdmin: true,
      },
    });
  });

  it("returns a deterministic error when auth is not configured", async () => {
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET", "");

    const response = await requestWithToken(signMoonlightScholarToken());
    const body = (await response.json()) as AuthMeResponseBody;

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      code: "MOONLIGHT_SCHOLAR_AUTH_NOT_CONFIGURED",
      action: "retry",
      retryable: true,
    });
  });
});

async function requestWithToken(token: string): Promise<Response> {
  const { GET } = await import("../route");

  return GET(
    new NextRequest("https://lighthouse.example.com/api/auth/moonlight-scholar/me", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    }),
  );
}

function signMoonlightScholarToken(
  options: {
    readonly audience?: string;
    readonly email?: string;
    readonly expiresIn?: number;
    readonly optionalClaims?: boolean;
    readonly plan?: string;
    readonly secret?: string;
    readonly subject?: string;
  } = {},
): string {
  const signOptions: SignOptions = {
    algorithm: "HS256",
    audience: options.audience ?? "moonlight-scholar",
    expiresIn: options.expiresIn ?? 900,
    issuer: "moonlight",
    subject: options.subject ?? "moonlight-user-1",
  };

  return jwt.sign(
    options.optionalClaims === false
      ? {
          email: options.email ?? "pilot@example.com",
        }
      : {
          email: options.email ?? "pilot@example.com",
          plan: options.plan ?? "pro",
          isAdmin: true,
        },
    options.secret ?? jwtSecret,
    signOptions,
  );
}

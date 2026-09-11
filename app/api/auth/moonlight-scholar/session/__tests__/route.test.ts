import { NextRequest } from "next/server";
import * as jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MOONLIGHT_SCHOLAR_LOCAL_SESSION_COOKIE,
  MOONLIGHT_SCHOLAR_SESSION_COOKIE,
  MOONLIGHT_SCHOLAR_SESSION_MAX_AGE_SECONDS,
} from "@/app/server/auth/moonlight-scholar-token";

const jwtSecret = "local-moonlight-scholar-secret";
const scheduleAppUserSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/server/auth/app-user-snapshot", () => ({
  scheduleAppUserSnapshot: scheduleAppUserSnapshotMock,
}));

type AuthSessionResponseBody =
  | {
      readonly ok: true;
      readonly user?: {
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

describe("Moonlight Scholar session route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET", jwtSecret);
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER", "moonlight");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE", "moonlight-scholar");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sets a Light House HttpOnly session cookie after verifying the Moonlight Scholar token", async () => {
    const token = signMoonlightScholarToken();
    const response = await requestSession(token);
    const body = (await response.json()) as AuthSessionResponseBody;

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
    expect(scheduleAppUserSnapshotMock).toHaveBeenCalledWith({
      principal: "moonlight-user-1",
      email: "pilot@example.com",
      backfill: true,
    });
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${MOONLIGHT_SCHOLAR_SESSION_COOKIE}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain(`Max-Age=${String(MOONLIGHT_SCHOLAR_SESSION_MAX_AGE_SECONDS)}`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=lax");
  });

  it("rejects a missing token without setting the session cookie", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/moonlight-scholar/session", {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
          origin: "https://lighthouse.example.com",
        },
      }),
    );
    const body = (await response.json()) as AuthSessionResponseBody;

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
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(scheduleAppUserSnapshotMock).not.toHaveBeenCalled();
  });

  it("distinguishes malformed JSON as 400 and an oversized body as 413", async () => {
    const { POST } = await import("../route");
    const malformed = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/moonlight-scholar/session", {
        method: "POST",
        body: "{",
        headers: {
          origin: "https://lighthouse.example.com",
        },
      }),
    );
    const oversized = await POST(
      new NextRequest("https://lighthouse.example.com/api/auth/moonlight-scholar/session", {
        method: "POST",
        body: "{}",
        headers: {
          "content-length": "16385",
          origin: "https://lighthouse.example.com",
        },
      }),
    );

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(scheduleAppUserSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects a hostile origin without setting the session cookie", async () => {
    const token = signMoonlightScholarToken();
    const response = await requestSession(token, { origin: "https://attacker.example.com" });
    const body = (await response.json()) as AuthSessionResponseBody;

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      code: "MOONLIGHT_SCHOLAR_ORIGIN_INVALID",
      action: "request-permission",
      retryable: false,
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(scheduleAppUserSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects a missing origin before exchanging the session cookie", async () => {
    const token = signMoonlightScholarToken();
    const response = await requestSession(token, { origin: null });
    const body = (await response.json()) as AuthSessionResponseBody;

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      ok: false,
      code: "MOONLIGHT_SCHOLAR_ORIGIN_INVALID",
      action: "request-permission",
      retryable: false,
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(scheduleAppUserSnapshotMock).not.toHaveBeenCalled();
  });

  it("accepts a target-valid token without optional plan or admin claims", async () => {
    const token = signMoonlightScholarToken({ optionalClaims: false });
    const response = await requestSession(token);
    const body = (await response.json()) as AuthSessionResponseBody;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      user: {
        id: "moonlight-user-1",
        email: "pilot@example.com",
      },
    });
    expect(scheduleAppUserSnapshotMock).toHaveBeenCalledWith({
      principal: "moonlight-user-1",
      email: "pilot@example.com",
      backfill: true,
    });
  });

  it("clears the session cookie", async () => {
    const { DELETE } = await import("../route");
    const response = DELETE();

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${MOONLIGHT_SCHOLAR_SESSION_COOKIE}=`);
    expect(setCookie).toContain(`${MOONLIGHT_SCHOLAR_LOCAL_SESSION_COOKIE}=`);
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
  });
});

async function requestSession(
  token: string,
  options: { readonly origin?: string | null } = {},
): Promise<Response> {
  const { POST } = await import("../route");
  const origin = options.origin === undefined ? "https://lighthouse.example.com" : options.origin;

  return POST(
    new NextRequest("https://lighthouse.example.com/api/auth/moonlight-scholar/session", {
      method: "POST",
      body: JSON.stringify({ token }),
      headers: {
        "content-type": "application/json",
        ...(origin === null ? {} : { origin }),
      },
    }),
  );
}

function signMoonlightScholarToken(
  options: {
    readonly optionalClaims?: boolean;
  } = {},
): string {
  const signOptions: SignOptions = {
    algorithm: "HS256",
    audience: "moonlight-scholar",
    expiresIn: 900,
    issuer: "moonlight",
    subject: "moonlight-user-1",
  };

  return jwt.sign(
    options.optionalClaims === false
      ? {
          email: "pilot@example.com",
        }
      : {
          email: "pilot@example.com",
          plan: "pro",
          isAdmin: true,
        },
    jwtSecret,
    signOptions,
  );
}

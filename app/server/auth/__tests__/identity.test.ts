import * as jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ReactModule from "react";

const createClientMock = vi.fn();
const createAdminClientMock = vi.fn();
const upsertAppUserSnapshotMock = vi.fn();
const backfillOwnerPrincipalForEmailMock = vi.fn();
const resolveProductAccessForEmailMock = vi.fn();
const cookiesGetMock = vi.fn();
const cookiesGetAllMock = vi.fn();
const cookiesMock = vi.fn(() =>
  Promise.resolve({ get: cookiesGetMock, getAll: cookiesGetAllMock }),
);

// off-critical-path로 예약된 snapshot/backfill 콜백을 모아 두었다가 테스트에서 flush한다.
const scheduledAfterCallbacks: Array<Promise<unknown>> = [];

async function flushScheduledAfter(): Promise<void> {
  await Promise.all(scheduledAfterCallbacks);
}

vi.mock("@/app/server/auth/supabase", () => ({
  createClient: createClientMock,
  createAdminClient: createAdminClientMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

// `after(cb)`를 동기로 실행해 예약된 app_users snapshot/backfill을 관측 가능하게 한다.
// 예약 콜백(run)은 async이므로 반환 promise를 모아 두고 flushScheduledAfter로 기다린다.
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    scheduledAfterCallbacks.push(Promise.resolve(cb()));
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual: typeof ReactModule = await importOriginal();
  return {
    ...actual,
    cache: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
      const cachedResults = new Map<string, Result>();
      return (...args: Args) => {
        const key = JSON.stringify(args);
        if (!cachedResults.has(key)) {
          cachedResults.set(key, fn(...args));
        }
        return cachedResults.get(key) as Result;
      };
    },
  };
});

vi.mock("@/app/lib/supabase/auth-helpers", () => ({
  hasSupabaseAuthSessionCookie: vi.fn((cookies: ReadonlyArray<{ name: string }>) =>
    cookies.some(
      ({ name }) =>
        name.startsWith("sb-") && name.includes("-auth-token") && !name.includes("-code-verifier"),
    ),
  ),
  isLocalSupabaseUrl: vi.fn().mockReturnValue(false),
  isRefreshTokenNotFoundError: vi.fn().mockReturnValue(false),
  listSupabaseAuthCookieNames: vi.fn((cookies: ReadonlyArray<{ name: string }>) =>
    cookies
      .filter(
        ({ name }) =>
          name.startsWith("sb-") &&
          name.includes("-auth-token") &&
          !name.includes("-code-verifier"),
      )
      .map(({ name }) => name),
  ),
}));

vi.mock("@/app/server/domain-access/access-allowlist-access", () => ({
  resolveProductAccessForEmail: resolveProductAccessForEmailMock,
}));

vi.mock("@/app/server/repository/app-users", () => ({
  upsertAppUserSnapshot: upsertAppUserSnapshotMock,
  backfillOwnerPrincipalForEmail: backfillOwnerPrincipalForEmailMock,
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  scheduledAfterCallbacks.length = 0;
  cookiesGetMock.mockReturnValue(undefined);
  cookiesGetAllMock.mockReturnValue([{ name: "sb-local-auth-token" }]);
  resolveProductAccessForEmailMock.mockResolvedValue("allowed");
  upsertAppUserSnapshotMock.mockResolvedValue(undefined);
  backfillOwnerPrincipalForEmailMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth identity Supabase session", () => {
  it("bypasses the external DB capability for internal access and contains initialization errors", async () => {
    const { resolveCurrentProductAccessForEmail } = await import("@/app/server/auth/identity");

    await expect(resolveCurrentProductAccessForEmail(" Admin@Corca.AI ")).resolves.toBe("allowed");
    expect(createAdminClientMock).not.toHaveBeenCalled();

    createAdminClientMock.mockImplementationOnce(() => {
      throw new Error("service role unavailable");
    });
    await expect(resolveCurrentProductAccessForEmail("pilot@example.com")).resolves.toBe(
      "unavailable",
    );
  });

  it("returns an opaque repository handle without scheduling app-user snapshot writes", async () => {
    const sessionDb = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: " Test@Corca.AI ",
            },
          },
          error: null,
        }),
      },
    };
    const adminDb = { from: vi.fn() };
    createClientMock.mockResolvedValue(sessionDb);
    createAdminClientMock.mockReturnValue(adminDb);

    const { resolveAuth } = await import("@/app/server/auth/identity");
    const result = await resolveAuth();
    await flushScheduledAfter();

    // 인증 hot-path는 app_users write를 만들지 않는다. Raw RLS-bypass client는
    // repository-owned handle 안에 숨고, owner key는 Supabase user id(principal)다.
    expect(result).toMatchObject({
      user: {
        id: "user-1",
        email: "test@corca.ai",
      },
    });
    expect(result?.db).not.toBe(adminDb);
    expect(result?.db).not.toHaveProperty("from");
    expect(upsertAppUserSnapshotMock).not.toHaveBeenCalled();
    expect(backfillOwnerPrincipalForEmailMock).not.toHaveBeenCalled();
  });

  it("skips Supabase auth server reads when no Supabase auth session cookie exists", async () => {
    cookiesGetAllMock.mockReturnValue([]);
    const sessionDb = {
      auth: {
        getUser: vi.fn(),
      },
    };
    createClientMock.mockResolvedValue(sessionDb);

    const { requireAuth, resolveAuth, resolveCurrentUser } =
      await import("@/app/server/auth/identity");

    await expect(resolveAuth()).resolves.toBeNull();
    await expect(resolveCurrentUser()).resolves.toBeNull();
    await expect(requireAuth()).rejects.toMatchObject({ name: "UnauthenticatedError" });
    await flushScheduledAfter();

    expect(createClientMock).not.toHaveBeenCalled();
    expect(sessionDb.auth.getUser).not.toHaveBeenCalled();
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(upsertAppUserSnapshotMock).not.toHaveBeenCalled();
    expect(backfillOwnerPrincipalForEmailMock).not.toHaveBeenCalled();
  });

  it("reuses one auth resolution across current-user helpers in the same render request", async () => {
    const sessionDb = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "reader@example.com",
            },
          },
          error: null,
        }),
      },
    };
    const adminDb = { from: vi.fn() };
    createClientMock.mockResolvedValue(sessionDb);
    createAdminClientMock.mockReturnValue(adminDb);

    const { requireAuth, requireCurrentUser, resolveAuth, resolveCurrentUser } =
      await import("@/app/server/auth/identity");

    const [auth, resolvedUser, requiredAuth, requiredUser] = await Promise.all([
      resolveAuth(),
      resolveCurrentUser(),
      requireAuth(),
      requireCurrentUser(),
    ]);
    await flushScheduledAfter();

    expect(sessionDb.auth.getUser).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    // 같은 render 요청에서 인증 resolution은 하나이고, snapshot write는 session-touch가 소유한다.
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(upsertAppUserSnapshotMock).not.toHaveBeenCalled();
    expect(backfillOwnerPrincipalForEmailMock).not.toHaveBeenCalled();
    expect(auth?.source).toBe("supabase");
    expect(auth?.user).toEqual({ id: "user-1", email: "reader@example.com" });
    expect(resolvedUser).toEqual(auth?.user);
    expect(requiredAuth).toBe(auth);
    expect(requiredUser).toEqual(auth?.user);
  });

  it("fails closed when the Supabase session cannot initialize its repository handle", async () => {
    createClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "pilot@example.com" } },
          error: null,
        }),
      },
    });
    createAdminClientMock.mockImplementationOnce(() => {
      throw new Error("service role unavailable");
    });

    const { resolveAuth } = await import("@/app/server/auth/identity");

    await expect(resolveAuth()).resolves.toBeNull();
    expect(resolveProductAccessForEmailMock).not.toHaveBeenCalled();
  });
});

describe("auth identity Moonlight Scholar session", () => {
  it("prefers the Moonlight Scholar session cookie for current-user helpers", async () => {
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET", "local-moonlight-scholar-secret");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER", "moonlight");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE", "moonlight-scholar");
    cookiesGetMock.mockReturnValue({
      value: signMoonlightScholarToken({ email: " Pilot@Example.com " }),
    });
    const adminDb = { from: vi.fn() };
    createAdminClientMock.mockReturnValue(adminDb);

    const { requireCurrentUser, requireOwnerPrincipalAuth, resolveCurrentUser } =
      await import("@/app/server/auth/identity");

    // owner key는 검증된 token sub(principal)다 — app_users 조회로 매핑하지 않는다.
    await expect(resolveCurrentUser()).resolves.toEqual({
      id: "moonlight-user-1",
      email: "pilot@example.com",
    });
    await expect(requireCurrentUser()).resolves.toEqual({
      id: "moonlight-user-1",
      email: "pilot@example.com",
    });
    const ownerAuth = await requireOwnerPrincipalAuth();
    expect(ownerAuth).toMatchObject({
      source: "moonlight_scholar",
      user: {
        id: "moonlight-user-1",
        email: "pilot@example.com",
      },
    });
    expect(ownerAuth.db).not.toBe(adminDb);
    expect(ownerAuth.db).not.toHaveProperty("from");
    await flushScheduledAfter();

    expect(cookiesGetMock).toHaveBeenCalledWith("lighthouse_moonlight_scholar_session");
    expect(createClientMock).not.toHaveBeenCalled();
    // Moonlight auth 해석도 write-free다. session POST가 snapshot/backfill을 소유한다.
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(upsertAppUserSnapshotMock).not.toHaveBeenCalled();
    expect(backfillOwnerPrincipalForEmailMock).not.toHaveBeenCalled();
  });

  it("fails closed when a Moonlight session cannot initialize its repository handle", async () => {
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET", "local-moonlight-scholar-secret");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER", "moonlight");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE", "moonlight-scholar");
    cookiesGetMock.mockReturnValue({
      value: signMoonlightScholarToken({ email: "pilot@example.com" }),
    });
    cookiesGetAllMock.mockReturnValue([]);
    createAdminClientMock.mockImplementationOnce(() => {
      throw new Error("service role unavailable");
    });

    const { resolveCurrentUser } = await import("@/app/server/auth/identity");

    await expect(resolveCurrentUser()).resolves.toBeNull();
    expect(resolveProductAccessForEmailMock).not.toHaveBeenCalled();
  });

  it("accepts Moonlight Scholar session cookies without optional plan or admin claims", async () => {
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET", "local-moonlight-scholar-secret");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER", "moonlight");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE", "moonlight-scholar");
    cookiesGetMock.mockReturnValue({
      value: signMoonlightScholarToken({ optionalClaims: false }),
    });
    const adminDb = { from: vi.fn() };
    createAdminClientMock.mockReturnValue(adminDb);

    const { requireOwnerPrincipalAuth, resolveCurrentUser } =
      await import("@/app/server/auth/identity");

    await expect(resolveCurrentUser()).resolves.toEqual({
      id: "moonlight-user-1",
      email: "pilot@example.com",
    });
    const ownerAuth = await requireOwnerPrincipalAuth();
    expect(ownerAuth).toMatchObject({
      source: "moonlight_scholar",
      user: {
        id: "moonlight-user-1",
        email: "pilot@example.com",
      },
    });
    expect(ownerAuth.db).not.toBe(adminDb);
    expect(ownerAuth.db).not.toHaveProperty("from");
    await flushScheduledAfter();

    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(upsertAppUserSnapshotMock).not.toHaveBeenCalled();
    expect(backfillOwnerPrincipalForEmailMock).not.toHaveBeenCalled();
  });

  it("keeps Moonlight Scholar users behind the production email allowlist", async () => {
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET", "local-moonlight-scholar-secret");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER", "moonlight");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE", "moonlight-scholar");
    resolveProductAccessForEmailMock.mockResolvedValue("denied");
    cookiesGetMock.mockReturnValue({
      value: signMoonlightScholarToken({ email: "external@example.net" }),
    });
    const sessionDb = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    createClientMock.mockResolvedValue(sessionDb);

    const { requireOwnerPrincipalAuth, resolveCurrentUser } =
      await import("@/app/server/auth/identity");

    await expect(resolveCurrentUser()).resolves.toBeNull();
    await expect(requireOwnerPrincipalAuth()).rejects.toMatchObject({
      name: "UnauthenticatedError",
    });
    await flushScheduledAfter();

    // 외부 접속 결정은 opaque repository handle을 통해 읽고, 차단되면 null로 끝난다.
    expect(resolveProductAccessForEmailMock).toHaveBeenCalledWith(
      expect.anything(),
      "external@example.net",
    );
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
    expect(upsertAppUserSnapshotMock).not.toHaveBeenCalled();
    expect(backfillOwnerPrincipalForEmailMock).not.toHaveBeenCalled();
  });

  it("keeps requireAuth tied to the Supabase-backed session", async () => {
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET", "local-moonlight-scholar-secret");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER", "moonlight");
    vi.stubEnv("MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE", "moonlight-scholar");
    cookiesGetMock.mockReturnValue({ value: signMoonlightScholarToken() });
    const adminDb = { from: vi.fn() };
    createAdminClientMock.mockReturnValue(adminDb);
    const sessionDb = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    };
    createClientMock.mockResolvedValue(sessionDb);

    const { requireAuth, requireOwnerPrincipalAuth, resolveCurrentUser } =
      await import("@/app/server/auth/identity");

    await expect(resolveCurrentUser()).resolves.toEqual({
      id: "moonlight-user-1",
      email: "pilot@example.com",
    });
    const ownerAuth = await requireOwnerPrincipalAuth();
    expect(ownerAuth).toMatchObject({
      source: "moonlight_scholar",
      user: {
        id: "moonlight-user-1",
        email: "pilot@example.com",
      },
    });
    expect(ownerAuth.db).not.toBe(adminDb);
    expect(ownerAuth.db).not.toHaveProperty("from");
    // requireAuth는 Supabase 세션 전용으로 남는다 — Moonlight 세션은 통과시키지 않는다.
    await expect(requireAuth()).rejects.toMatchObject({ name: "UnauthenticatedError" });
    await flushScheduledAfter();
    expect(sessionDb.auth.getUser).toHaveBeenCalledTimes(1);
  });
});

function signMoonlightScholarToken(
  options: {
    readonly email?: string;
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
          email: options.email ?? "pilot@example.com",
        }
      : {
          email: options.email ?? "pilot@example.com",
          plan: "pro",
          isAdmin: true,
        },
    "local-moonlight-scholar-secret",
    signOptions,
  );
}

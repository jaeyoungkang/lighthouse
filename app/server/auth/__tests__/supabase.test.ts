import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CreateServerClientOptions = {
  readonly cookies?: {
    readonly getAll: () => unknown;
    readonly setAll: (
      cookies: ReadonlyArray<{
        readonly name: string;
        readonly value: string;
        readonly options?: Record<string, unknown>;
      }>,
    ) => void;
  };
  readonly global?: {
    readonly fetch?: typeof fetch;
  };
};

const createServerClientMock = vi.hoisted(() => vi.fn());
const createAdminSupabaseClientMock = vi.hoisted(() => vi.fn());
const cookieGetAllMock = vi.hoisted(() =>
  vi.fn<() => Array<{ name: string; value: string }>>(() => []),
);
const cookieSetMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      getAll: cookieGetAllMock,
      set: cookieSetMock,
    }),
  ),
);

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createAdminSupabaseClientMock,
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

describe("server Supabase client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("constructs the session client with exact environment and cookie authority", async () => {
    cookieGetAllMock.mockReturnValueOnce([
      { name: "sb-project-auth-token", value: "session-cookie" },
    ]);

    const { createClient } = await import("@/app/server/auth/supabase");
    await createClient();

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    const call = createServerClientMock.mock.calls[0] as unknown as
      | [string, string, CreateServerClientOptions]
      | undefined;
    expect(call?.slice(0, 2)).toEqual(["https://supabase.example.com", "anon-key"]);
    const options = call?.[2];
    expect(options?.cookies).toBeDefined();
    expect(options?.global).toBeUndefined();
    expect(options?.cookies?.getAll()).toEqual([
      { name: "sb-project-auth-token", value: "session-cookie" },
    ]);

    options?.cookies?.setAll([
      {
        name: "sb-project-auth-token",
        value: "next-session-cookie",
        options: { httpOnly: true },
      },
    ]);
    expect(cookieSetMock).toHaveBeenCalledWith("sb-project-auth-token", "next-session-cookie", {
      httpOnly: true,
    });
  });

  it("rejects missing session-client environment before client construction", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { createClient } = await import("@/app/server/auth/supabase");

    await expect(createClient()).rejects.toThrow(
      "Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("constructs the service-role client with exact server-only authority", async () => {
    const adminClient = { source: "admin" };
    createAdminSupabaseClientMock.mockReturnValueOnce(adminClient);
    const { createAdminClient } = await import("@/app/server/auth/supabase");

    expect(createAdminClient()).toBe(adminClient);
    expect(createAdminSupabaseClientMock).toHaveBeenCalledWith(
      "https://supabase.example.com",
      "service-role-key",
    );
  });

  it("rejects missing service-role authority before admin client construction", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { createAdminClient } = await import("@/app/server/auth/supabase");

    expect(() => createAdminClient()).toThrow(
      "Missing environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
    expect(createAdminSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("binds the provided abort signal when Supabase fetch has no init signal", async () => {
    const outerController = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await createSignalAwareClient(outerController.signal);
    const signalBoundFetch = getSignalBoundFetch();
    await signalBoundFetch("https://supabase.example.com/auth/v1/user");

    expect(fetchMock).toHaveBeenCalledWith("https://supabase.example.com/auth/v1/user", {
      signal: outerController.signal,
    });
  });

  it("aborts the merged Supabase fetch signal when the outer deadline signal aborts", async () => {
    const outerController = new AbortController();
    const initController = new AbortController();
    const fetchMock = createAbortAwareFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await createSignalAwareClient(outerController.signal);
    const signalBoundFetch = getSignalBoundFetch();
    const fetchPromise = signalBoundFetch("https://supabase.example.com/auth/v1/user", {
      signal: initController.signal,
    });
    outerController.abort();

    await expect(fetchPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("aborts the merged Supabase fetch signal when the init signal aborts", async () => {
    const outerController = new AbortController();
    const initController = new AbortController();
    const fetchMock = createAbortAwareFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await createSignalAwareClient(outerController.signal);
    const signalBoundFetch = getSignalBoundFetch();
    const fetchPromise = signalBoundFetch("https://supabase.example.com/auth/v1/user", {
      signal: initController.signal,
    });
    initController.abort();

    await expect(fetchPromise).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("enters Supabase fetch with an aborted merged signal when both inputs are already aborted", async () => {
    const outerController = new AbortController();
    const initController = new AbortController();
    outerController.abort();
    initController.abort();
    const fetchMock = createAbortAwareFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    await createSignalAwareClient(outerController.signal);
    const signalBoundFetch = getSignalBoundFetch();

    await expect(
      signalBoundFetch("https://supabase.example.com/auth/v1/user", {
        signal: initController.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it.each(["outer", "init"] as const)(
    "enters Supabase fetch with an aborted merged signal when only %s is already aborted",
    async (abortedInput) => {
      const outerController = new AbortController();
      const initController = new AbortController();
      (abortedInput === "outer" ? outerController : initController).abort();
      const fetchMock = createAbortAwareFetchMock();
      vi.stubGlobal("fetch", fetchMock);

      await createSignalAwareClient(outerController.signal);
      const signalBoundFetch = getSignalBoundFetch();

      await expect(
        signalBoundFetch("https://supabase.example.com/auth/v1/user", {
          signal: initController.signal,
        }),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    },
  );

  it("keeps the merged signal active while neither input is aborted", async () => {
    const outerController = new AbortController();
    const initController = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await createSignalAwareClient(outerController.signal);
    const signalBoundFetch = getSignalBoundFetch();
    await signalBoundFetch("https://supabase.example.com/auth/v1/user", {
      signal: initController.signal,
    });

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
  });

  it("removes merged abort listeners after Supabase fetch settles", async () => {
    const outerController = new AbortController();
    const initController = new AbortController();
    const outerRemove = vi.spyOn(outerController.signal, "removeEventListener");
    const initRemove = vi.spyOn(initController.signal, "removeEventListener");
    const outerAdd = vi.spyOn(outerController.signal, "addEventListener");
    const initAdd = vi.spyOn(initController.signal, "addEventListener");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await createSignalAwareClient(outerController.signal);
    const signalBoundFetch = getSignalBoundFetch();
    await signalBoundFetch("https://supabase.example.com/auth/v1/user", {
      signal: initController.signal,
    });

    expect(outerRemove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(initRemove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(outerAdd).toHaveBeenCalledWith("abort", expect.any(Function), { once: true });
    expect(initAdd).toHaveBeenCalledWith("abort", expect.any(Function), { once: true });
  });
});

async function createSignalAwareClient(signal: AbortSignal): Promise<void> {
  const { createClient } = await import("@/app/server/auth/supabase");
  await createClient({ signal });
}

function getSignalBoundFetch(): typeof fetch {
  const options = createServerClientMock.mock.calls[0]?.[2] as
    | CreateServerClientOptions
    | undefined;
  const signalBoundFetch = options?.global?.fetch;
  if (!signalBoundFetch) {
    throw new Error("Expected Supabase client global.fetch to be configured");
  }

  return signalBoundFetch;
}

function createAbortAwareFetchMock(): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("aborted", "AbortError"));
          return;
        }

        signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("aborted", "AbortError"));
          },
          { once: true },
        );
      }),
  );
}

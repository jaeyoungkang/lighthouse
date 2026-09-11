import { describe, expect, it, vi } from "vitest";
import { waitForPostgrestSchema } from "../run-gap-report-concurrency";

function createClock() {
  let currentMs = 0;
  return {
    now: () => currentMs,
    sleep: vi.fn((durationMs: number) => {
      currentMs += durationMs;
      return Promise.resolve();
    }),
  };
}

function schemaCacheUnavailable(): Response {
  return new Response(
    JSON.stringify({
      code: "PGRST002",
      message: "Could not query the database for the schema cache. Retrying.",
    }),
    { status: 503 },
  );
}

describe("PostgREST schema readiness", () => {
  it("probes the exact lighthouse gap_reports REST seam with service-role authority", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const clock = createClock();

    await expect(
      waitForPostgrestSchema({
        apiUrl: "http://127.0.0.1:54321",
        serviceRoleKey: "test-service-role-key",
        fetchImpl: fetchMock,
        ...clock,
      }),
    ).resolves.toEqual({ attempts: 1, elapsedMs: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(input).toBeInstanceOf(URL);
    if (!(input instanceof URL)) throw new TypeError("readiness probe input must be a URL");
    expect(input.href).toBe("http://127.0.0.1:54321/rest/v1/gap_reports?select=id&limit=0");
    const headers = new Headers(init?.headers);
    expect(init?.method).toBe("GET");
    expect(headers.get("accept-profile")).toBe("lighthouse");
    expect(headers.get("authorization")).toBe("Bearer test-service-role-key");
    expect(headers.get("apikey")).toBe("test-service-role-key");
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it("waits through the schema-cache startup race before reporting ready", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(schemaCacheUnavailable())
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const clock = createClock();

    await expect(
      waitForPostgrestSchema({
        apiUrl: "http://localhost:54321",
        serviceRoleKey: "test-service-role-key",
        fetchImpl: fetchMock,
        timeoutMs: 1_000,
        retryDelayMs: 250,
        ...clock,
      }),
    ).resolves.toEqual({ attempts: 2, elapsedMs: 250 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(clock.sleep).toHaveBeenCalledOnce();
    expect(clock.sleep).toHaveBeenCalledWith(250);
  });

  it("fails closed with the last schema-cache error after the bounded timeout", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(schemaCacheUnavailable()));
    const clock = createClock();

    await expect(
      waitForPostgrestSchema({
        apiUrl: "http://localhost:54321",
        serviceRoleKey: "test-service-role-key",
        fetchImpl: fetchMock,
        timeoutMs: 1_000,
        retryDelayMs: 250,
        ...clock,
      }),
    ).rejects.toThrow(
      "PostgREST schema readiness timed out after 1000ms (4 attempts). Last failure: HTTP 503",
    );

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not hide non-readiness contract failures behind retries", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"message":"Invalid API key"}', { status: 401 }));
    const clock = createClock();

    await expect(
      waitForPostgrestSchema({
        apiUrl: "http://localhost:54321",
        serviceRoleKey: "bad-service-role-key",
        fetchImpl: fetchMock,
        ...clock,
      }),
    ).rejects.toThrow(
      'PostgREST schema readiness failed without retry after 1 attempt(s): HTTP 401: {"message":"Invalid API key"}',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it("rejects non-loopback targets before forwarding the service-role key", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      waitForPostgrestSchema({
        apiUrl: "https://db.example.com",
        serviceRoleKey: "must-not-be-forwarded",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow(
      "PostgREST readiness URL must be loopback-only for destructive integration cleanup.",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const globalFetch = vi.fn();

function createConnectFailure(code: string): TypeError {
  const cause = Object.assign(new AggregateError([]), { code });
  return Object.assign(new TypeError("fetch failed"), { cause });
}

function resetProviderFetchTest(): void {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", globalFetch);
  vi.useRealTimers();
}

function restoreProviderFetchTest(): void {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
}

describe("literature-provider-fetch", () => {
  beforeEach(resetProviderFetchTest);
  afterEach(restoreProviderFetchTest);

  it("sends only provider-neutral headers to Episteme", async () => {
    globalFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    await epistemeFetch("https://sah.borca.ai/api/v3/search/papers/capabilities?q=test");

    const [, init] = globalFetch.mock.calls[0] as [string, RequestInit | undefined];
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      "User-Agent": "lighthouse-search/1.0",
    });
    expect(init?.headers).not.toHaveProperty("x-api-key");
    expect(init?.redirect).toBe("error");
  });

  it("sends POST bodies only to Episteme without following redirects", async () => {
    globalFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { epistemePostFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    await epistemePostFetch("https://sah.borca.ai/api/v3/papers/batch", {
      papers: ["s2:1"],
      projection: "rich",
    });

    const [, init] = globalFetch.mock.calls[0] as [string, RequestInit | undefined];
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      body: JSON.stringify({ papers: ["s2:1"], projection: "rich" }),
    });
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "lighthouse-search/1.0",
    });
    expect(init?.headers).not.toHaveProperty("x-api-key");
  });

  it("rejects retired unversioned Episteme endpoints", async () => {
    const { epistemeFetch, epistemePostFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");

    await expect(epistemeFetch("https://sah.borca.ai/search?q=legacy")).rejects.toThrow(
      "only permits approved Episteme 3 API endpoints",
    );
    await expect(
      epistemePostFetch("https://sah.borca.ai/papers/batch", { corpus_ids: [1] }),
    ).rejects.toThrow("only permits approved Episteme 3 API endpoints");
    await expect(epistemeFetch("https://sah.borca.ai/api/v3/paper/search")).rejects.toThrow(
      "only permits approved Episteme 3 API endpoints",
    );
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("rejects direct Semantic Scholar and lookalike outbound URLs for GET and POST", async () => {
    const { epistemeFetch, epistemePostFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    const invalidUrls = [
      "https://api.semanticscholar.org/graph/v1/paper/search",
      "https://evilsemanticscholar.org/graph/v1/paper/search",
      "http://sah.borca.ai/api/v3/search/papers/capabilities",
      "https://sah.borca.ai:444/search",
    ];
    for (const url of invalidUrls) {
      await expect(epistemeFetch(url)).rejects.toThrow("only permits the configured Episteme host");
      await expect(epistemePostFetch(url, { corpus_ids: [1] })).rejects.toThrow(
        "only permits the configured Episteme host",
      );
    }
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("does not pace back-to-back Episteme requests (no 1.1s throttle)", async () => {
    vi.useFakeTimers();
    globalFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    void epistemeFetch("https://sah.borca.ai/api/v3/search/papers/capabilities?q=a");
    void epistemeFetch("https://sah.borca.ai/api/v3/search/papers/capabilities?q=b");

    // 타이머를 1.1s만큼 advance하지 않아도 두 Episteme 요청이 모두 발사된다.
    await vi.advanceTimersByTimeAsync(0);
    expect(globalFetch).toHaveBeenCalledTimes(2);
  });
});

describe("literature-provider-fetch Episteme connect retry", () => {
  beforeEach(resetProviderFetchTest);
  afterEach(restoreProviderFetchTest);

  it.each(["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"])(
    "retries Episteme cold connect failure %s once inside the same logical observation",
    async (errorCode) => {
      const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      globalFetch.mockRejectedValueOnce(createConnectFailure(errorCode)).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

      const { epistemeFetch } =
        await import("@/app/server/external-http-gateway/literature-provider-fetch");
      await expect(
        epistemeFetch("https://sah.borca.ai/api/v3/search/papers/capabilities?q=cold-connect"),
      ).resolves.toMatchObject({
        status: 200,
      });

      expect(globalFetch).toHaveBeenCalledTimes(2);
      expect(info).toHaveBeenCalledTimes(1);
      const line = String(info.mock.calls[0]?.[0]);
      expect(line).not.toContain("cold-connect");
      const observation = JSON.parse(
        line.replace("[episteme-provider-observation] ", ""),
      ) as Record<string, unknown>;
      expect(observation).toMatchObject({
        outcome: "success",
        providerCallStarted: true,
        retryCount: 1,
      });
      warn.mockRestore();
      info.mockRestore();
    },
  );

  it("stops after one Episteme connect retry and reports the actual retry count", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    globalFetch.mockRejectedValue(createConnectFailure("ETIMEDOUT"));

    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    await expect(
      epistemeFetch("https://sah.borca.ai/api/v3/search/papers/capabilities?q=still-down"),
    ).resolves.toBeNull();

    expect(globalFetch).toHaveBeenCalledTimes(2);
    const line = String(info.mock.calls[0]?.[0]);
    const observation = JSON.parse(line.replace("[episteme-provider-observation] ", "")) as Record<
      string,
      unknown
    >;
    expect(observation).toMatchObject({
      outcome: "timeout-or-network",
      providerCallStarted: true,
      retryCount: 1,
    });
    warn.mockRestore();
    info.mockRestore();
  });

  it("does not retry unapproved Episteme network errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    globalFetch.mockRejectedValueOnce(createConnectFailure("ECONNRESET"));

    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    await expect(
      epistemeFetch("https://sah.borca.ai/api/v3/search/papers/capabilities?q=reset"),
    ).resolves.toBeNull();

    expect(globalFetch).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("does not retry a connect timeout when the caller aborts before retry", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const controller = new AbortController();
    globalFetch.mockImplementationOnce(() => {
      controller.abort();
      return Promise.reject(createConnectFailure("ETIMEDOUT"));
    });

    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    await expect(
      epistemeFetch(
        "https://sah.borca.ai/api/v3/search/papers/capabilities?q=cancel-before-retry",
        controller.signal,
      ),
    ).resolves.toBeNull();

    expect(globalFetch).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("literature-provider-fetch Episteme breaker", () => {
  beforeEach(resetProviderFetchTest);
  afterEach(restoreProviderFetchTest);

  it("fast-fails Episteme requests without calling fetch once the breaker trips open", async () => {
    // Episteme 하드 저하: 모든 호출이 503. Episteme는 per-call retry가 없어 첫 응답
    // 즉시 반환하고, 회로가 반복 실패를 모아 OPEN으로 돌린다.
    globalFetch.mockResolvedValue(new Response(null, { status: 503 }));

    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    for (let i = 0; i < 5; i++) {
      await epistemeFetch(`https://sah.borca.ai/api/v3/search/papers/capabilities?q=${String(i)}`);
    }
    expect(globalFetch).toHaveBeenCalledTimes(5);

    // 회로 OPEN 이후 Episteme 호출은 fetch 없이 null로 degrade한다(증폭 차단).
    const blocked = await epistemeFetch(
      "https://sah.borca.ai/api/v3/search/papers/capabilities?q=blocked",
    );
    expect(blocked).toBeNull();
    expect(globalFetch).toHaveBeenCalledTimes(5);
  });

  it("logs one privacy-safe provider observation without copying the search query", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    globalFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    await epistemeFetch(
      "https://sah.borca.ai/api/v3/search/papers/capabilities?q=never-log-this-query",
    );

    expect(info).toHaveBeenCalledTimes(1);
    const line = String(info.mock.calls[0]?.[0]);
    expect(line.startsWith("[episteme-provider-observation] ")).toBe(true);
    expect(line).not.toContain("never-log-this-query");

    const observation = JSON.parse(line.replace("[episteme-provider-observation] ", "")) as Record<
      string,
      unknown
    >;
    expect(observation).toMatchObject({
      schemaVersion: 1,
      event: "episteme_provider_observation",
      lane: "core",
      path: "/api/v3/search/papers/capabilities",
      outcome: "success",
      status: 200,
      providerCallStarted: true,
      retryCount: 0,
    });
    expect(observation).not.toHaveProperty("query");
    expect(observation).not.toHaveProperty("url");
    info.mockRestore();
  });

  it("redacts E3 citation paper refs and keeps explicit optional-lane calls", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    globalFetch.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    await epistemeFetch(
      "https://sah.borca.ai/api/v3/graph/citations?paper=s2%3A123456&direction=cites&limit=100",
      undefined,
      { lane: "optional" },
    );

    const line = String(info.mock.calls[0]?.[0]);
    expect(line).not.toContain("123456");
    const observation = JSON.parse(line.replace("[episteme-provider-observation] ", "")) as Record<
      string,
      unknown
    >;
    expect(observation).toMatchObject({
      lane: "optional",
      path: "/api/v3/graph/citations",
      outcome: "success",
    });
    info.mockRestore();
  });

  it("keeps the static batch path distinct from redacted paper identities", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    globalFetch.mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));

    const { epistemeFetch, epistemePostFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    await epistemePostFetch("https://sah.borca.ai/api/v3/papers/batch", { papers: ["s2:123456"] });
    await epistemeFetch("https://sah.borca.ai/api/v3/papers/by-ref?ref=s2:123456");
    await epistemeFetch("https://sah.borca.ai/api/v3/graph/citations?paper=s2:123456");

    expect(info).toHaveBeenCalledTimes(3);
    const observations = info.mock.calls.map(
      ([line]) =>
        JSON.parse(String(line).replace("[episteme-provider-observation] ", "")) as Record<
          string,
          unknown
        >,
    );
    expect(observations).toEqual([
      expect.objectContaining({
        lane: "optional",
        path: "/api/v3/papers/batch",
        outcome: "success",
      }),
      expect.objectContaining({ lane: "core", path: "/api/v3/papers/by-ref", outcome: "success" }),
      expect.objectContaining({
        lane: "core",
        path: "/api/v3/graph/citations",
        outcome: "success",
      }),
    ]);
    expect(info.mock.calls.join("\n")).not.toContain("123456");
    info.mockRestore();
  });

  it("distinguishes caller cancellation from an actual provider call", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const controller = new AbortController();
    controller.abort();

    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    await expect(
      epistemeFetch(
        "https://sah.borca.ai/api/v3/search/papers/capabilities?q=cancelled",
        controller.signal,
      ),
    ).resolves.toBeNull();

    expect(globalFetch).not.toHaveBeenCalled();
    const line = String(info.mock.calls[0]?.[0]);
    const observation = JSON.parse(line.replace("[episteme-provider-observation] ", "")) as Record<
      string,
      unknown
    >;
    expect(observation).toMatchObject({
      outcome: "caller-cancelled",
      providerCallStarted: false,
      status: null,
    });
    info.mockRestore();
  });

  it("keeps core keyword search healthy when only the optional graph breaker opens", async () => {
    const { epistemeFetch, epistemePostFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    globalFetch.mockResolvedValue(new Response(null, { status: 503 }));

    for (let i = 0; i < 5; i++) {
      await epistemePostFetch("https://sah.borca.ai/api/v3/papers/discover", {
        seeds: [`s2:${String(i + 1)}`],
      });
    }
    expect(globalFetch).toHaveBeenCalledTimes(5);
    expect(
      await epistemePostFetch("https://sah.borca.ai/api/v3/papers/discover", {
        seeds: ["s2:99"],
      }),
    ).toBeNull();
    expect(globalFetch).toHaveBeenCalledTimes(5);

    globalFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const keywordResponse = await epistemeFetch(
      "https://sah.borca.ai/api/v3/search/papers/capabilities",
    );

    expect(keywordResponse).toMatchObject({ status: 200 });
    expect(globalFetch).toHaveBeenCalledTimes(6);
  });

  it("reserves core capacity while an optional graph request is still hanging", async () => {
    vi.stubEnv("EPISTEME_TOTAL_CONCURRENCY_BUDGET", "4");
    vi.stubEnv("EPISTEME_PEAK_INSTANCE_BUDGET", "2");
    let releaseOptional!: (response: Response) => void;
    const hangingOptional = new Promise<Response>((resolve) => {
      releaseOptional = resolve;
    });
    globalFetch.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/v3/papers/discover")) return hangingOptional;
      return Promise.resolve(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const { epistemeFetch, epistemePostFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    const firstOptional = epistemePostFetch("https://sah.borca.ai/api/v3/papers/discover", {
      seeds: ["s2:1"],
    });
    await vi.waitFor(() => {
      expect(globalFetch).toHaveBeenCalledTimes(1);
    });

    const queuedOptional = epistemePostFetch("https://sah.borca.ai/api/v3/papers/discover", {
      seeds: ["s2:2"],
    });
    await Promise.resolve();
    expect(globalFetch).toHaveBeenCalledTimes(1);

    const keywordResponse = await epistemeFetch(
      "https://sah.borca.ai/api/v3/search/papers/capabilities",
    );
    expect(keywordResponse).toMatchObject({ status: 200 });
    expect(globalFetch).toHaveBeenCalledTimes(2);

    releaseOptional(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await Promise.all([firstOptional, queuedOptional]);
    expect(globalFetch).toHaveBeenCalledTimes(3);
  });
});

describe("literature-provider-fetch Episteme load shed observation", () => {
  beforeEach(resetProviderFetchTest);
  afterEach(restoreProviderFetchTest);

  it("fast-fails optional work when a one-slot budget must be reserved for core search", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubEnv("EPISTEME_TOTAL_CONCURRENCY_BUDGET", "2");
    vi.stubEnv("EPISTEME_PEAK_INSTANCE_BUDGET", "2");
    globalFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { epistemeFetch, epistemePostFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");
    const optional = await epistemePostFetch("https://sah.borca.ai/api/v3/papers/discover", {
      seeds: ["s2:1"],
    });
    expect(optional).toBeNull();
    expect(globalFetch).not.toHaveBeenCalled();
    const optionalObservation = JSON.parse(
      String(info.mock.calls[0]?.[0]).replace("[episteme-provider-observation] ", ""),
    ) as Record<string, unknown>;
    expect(optionalObservation).toMatchObject({
      lane: "optional",
      path: "/api/v3/papers/discover",
      outcome: "load-shed",
      providerCallStarted: false,
    });

    const keyword = await epistemeFetch(
      "https://sah.borca.ai/api/v3/search/papers/capabilities?q=healthy",
    );
    expect(keyword).toMatchObject({ status: 200 });
    expect(globalFetch).toHaveBeenCalledTimes(1);
    info.mockRestore();
  });
});

describe("literature-provider-fetch Episteme abort health", () => {
  beforeEach(resetProviderFetchTest);
  afterEach(restoreProviderFetchTest);

  it("does not count client-aborted Episteme calls as breaker failures", async () => {
    // 사용자가 떠나거나 route가 요청을 접은 client-abort는 Episteme 건강 신호가
    // 아니다 — 반복돼도 회로를 열지 않아, 뒤이은 건강한 그래프/검색 호출이
    // fast-fail로 라이브러리 그라운딩을 박탈당하지 않는다.
    const { epistemePostFetch, epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");

    const abortedController = new AbortController();
    abortedController.abort();
    for (let i = 0; i < 5; i++) {
      const aborted = await epistemePostFetch(
        "https://sah.borca.ai/api/v3/papers/discover",
        { corpus_ids: [i] },
        abortedController.signal,
      );
      expect(aborted).toBeNull();
    }
    // abort된 호출은 fetch 자체를 발사하지 않고 null degrade한다.
    expect(globalFetch).toHaveBeenCalledTimes(0);

    // 회로는 CLOSED 그대로 — 다음 건강한 Episteme 호출이 정상 fetch된다.
    globalFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const healthy = await epistemeFetch(
      "https://sah.borca.ai/api/v3/search/papers/capabilities?q=healthy",
    );
    expect(healthy).toMatchObject({ status: 200 });
    expect(globalFetch).toHaveBeenCalledTimes(1);
  });

  it("still counts a real 5xx returned despite caller abort as a breaker failure", async () => {
    // caller abort와 경합해도 provider가 실제 5xx Response를 돌려줬다면 그것은
    // Episteme 건강 신호다 — abort 면제는 null(요청 미완) 결과에만 적용된다.
    const { epistemeFetch } =
      await import("@/app/server/external-http-gateway/literature-provider-fetch");

    for (let i = 0; i < 5; i++) {
      const controller = new AbortController();
      globalFetch.mockImplementationOnce(() => {
        // 응답이 이미 확보된 뒤 caller가 abort하는 레이스.
        controller.abort();
        return Promise.resolve(new Response(null, { status: 503 }));
      });
      await epistemeFetch(
        `https://sah.borca.ai/api/v3/search/papers/capabilities?q=${String(i)}`,
        controller.signal,
      );
    }
    expect(globalFetch).toHaveBeenCalledTimes(5);

    // 5xx 5회가 그대로 실패로 집계되어 회로가 OPEN — 다음 호출은 fetch 없이 degrade.
    const blocked = await epistemeFetch(
      "https://sah.borca.ai/api/v3/search/papers/capabilities?q=blocked",
    );
    expect(blocked).toBeNull();
    expect(globalFetch).toHaveBeenCalledTimes(5);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetLibraryAnchorDisplayTitleCacheForTests,
  LIBRARY_ANCHOR_TITLE_CACHE_POLICY,
  resolveLibraryPresetPapers,
} from "@/app/server/services/library-anchor-display";
import { hydrateEpistemePapers } from "@/app/server/services/episteme-literature";

vi.mock("@/app/server/services/episteme-literature", () => ({
  hydrateEpistemePapers: vi.fn(),
}));

type HydratedPapers = Awaited<ReturnType<typeof hydrateEpistemePapers>>;

beforeEach(() => {
  vi.mocked(hydrateEpistemePapers).mockReset();
  __resetLibraryAnchorDisplayTitleCacheForTests();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveLibraryPresetPapers", () => {
  it("returns an empty list without a library context or provider call", async () => {
    await expect(resolveLibraryPresetPapers(null)).resolves.toEqual([]);
    expect(hydrateEpistemePapers).not.toHaveBeenCalled();
  });

  it("uses precomputed anchor paper titles before querying Episteme", async () => {
    const papers = await resolveLibraryPresetPapers({
      folders: [
        {
          name: "Agent Memory",
          anchorCorpusIds: ["101"],
          anchorPapers: [{ paperId: "101", title: "Long-Term Memory for Agents" }],
        },
      ],
      neighborhood: {},
      computedAt: "2026-06-26T00:00:00Z",
    });

    expect(papers).toEqual([
      { paperId: "101", title: "Long-Term Memory for Agents", folderName: "Agent Memory" },
    ]);
    expect(hydrateEpistemePapers).not.toHaveBeenCalled();
  });

  it("fills missing anchor paper titles from Episteme before rendering the list", async () => {
    vi.mocked(hydrateEpistemePapers).mockResolvedValueOnce([
      { paperId: "101", title: "Graph Retrieval from Episteme" },
      { paperId: "202", title: "Agent Memory from Episteme" },
    ] as unknown as HydratedPapers);

    const papers = await resolveLibraryPresetPapers({
      folders: [
        { name: "Graph Retrieval", anchorCorpusIds: ["101"] },
        { name: "Agent Memory", anchorCorpusIds: ["202"] },
      ],
      neighborhood: {},
      computedAt: "2026-06-26T00:00:00Z",
    });

    expect(hydrateEpistemePapers).toHaveBeenCalledWith([101, 202], expect.any(AbortSignal));
    expect(papers).toEqual([
      { paperId: "101", title: "Graph Retrieval from Episteme", folderName: "Graph Retrieval" },
      { paperId: "202", title: "Agent Memory from Episteme", folderName: "Agent Memory" },
    ]);
  });

  it("hydrates an E3-only anchor title through its canonical paper reference", async () => {
    vi.mocked(hydrateEpistemePapers).mockResolvedValueOnce([
      { paperId: "pap_e3_only", title: "Native E3 Anchor" },
    ] as unknown as HydratedPapers);

    const papers = await resolveLibraryPresetPapers({
      folders: [{ name: "E3", anchorCorpusIds: ["pap_e3_only"] }],
      neighborhood: {},
      computedAt: "2026-06-26T00:00:00Z",
    });

    expect(hydrateEpistemePapers).toHaveBeenCalledWith(["pap_e3_only"], expect.any(AbortSignal));
    expect(papers).toEqual([
      { paperId: "pap_e3_only", title: "Native E3 Anchor", folderName: "E3" },
    ]);
  });

  it("uses a non-numeric display fallback when title metadata cannot be hydrated", async () => {
    vi.mocked(hydrateEpistemePapers).mockResolvedValueOnce([] as HydratedPapers);

    const papers = await resolveLibraryPresetPapers({
      folders: [
        { name: "Graph Retrieval", anchorCorpusIds: ["101"] },
        { name: "Agent Memory", anchorCorpusIds: ["corpus-202"] },
      ],
      neighborhood: {},
      computedAt: "2026-06-26T00:00:00Z",
    });

    expect(hydrateEpistemePapers).toHaveBeenCalledWith([101], expect.any(AbortSignal));
    expect(papers).toEqual([
      { paperId: "101", title: "제목을 불러오지 못한 논문", folderName: "Graph Retrieval" },
      { paperId: "corpus-202", title: "제목을 불러오지 못한 논문", folderName: "Agent Memory" },
    ]);
  });

  it("keeps fallback when Episteme title hydration fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      vi.mocked(hydrateEpistemePapers).mockRejectedValueOnce(new Error("provider unavailable"));

      const papers = await resolveLibraryPresetPapers({
        folders: [{ name: "Graph Retrieval", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      });

      expect(hydrateEpistemePapers).toHaveBeenCalledWith([101], expect.any(AbortSignal));
      expect(papers).toEqual([
        { paperId: "101", title: "제목을 불러오지 못한 논문", folderName: "Graph Retrieval" },
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        "[library-anchor-display] Episteme title hydration failed",
        expect.objectContaining({
          failureKind: "provider_failure",
        }),
      );
      expect(warnSpy.mock.calls[0]?.[1]).not.toHaveProperty("errorMessage");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("falls back when Episteme title hydration exceeds the layout budget", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.useFakeTimers();
    try {
      vi.mocked(hydrateEpistemePapers).mockImplementationOnce(
        (_corpusIds, signal) =>
          new Promise((_, reject) => {
            signal?.addEventListener("abort", () => {
              reject(new DOMException("title hydration timed out", "AbortError"));
            });
          }),
      );

      const papersPromise = resolveLibraryPresetPapers({
        folders: [{ name: "Graph Retrieval", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      });

      await vi.advanceTimersByTimeAsync(800);

      await expect(papersPromise).resolves.toEqual([
        { paperId: "101", title: "제목을 불러오지 못한 논문", folderName: "Graph Retrieval" },
      ]);
      expect(hydrateEpistemePapers).toHaveBeenCalledWith([101], expect.any(AbortSignal));
    } finally {
      vi.useRealTimers();
      warnSpy.mockRestore();
    }
  });

  it("lets one caller abort without cancelling another subscriber's shared fill", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const controller = new AbortController();
      let hydrationSignal: AbortSignal | undefined;
      let resolveHydration: ((papers: HydratedPapers) => void) | undefined;
      vi.mocked(hydrateEpistemePapers).mockImplementationOnce(
        (_corpusIds, signal) =>
          new Promise((resolve) => {
            hydrationSignal = signal;
            resolveHydration = resolve;
          }),
      );

      const abortedCaller = resolveLibraryPresetPapers(
        {
          folders: [{ name: "Graph Retrieval", anchorCorpusIds: ["101"] }],
          neighborhood: {},
          computedAt: "2026-06-26T00:00:00Z",
        },
        { signal: controller.signal },
      );
      const activeCaller = resolveLibraryPresetPapers({
        folders: [{ name: "Agent Memory", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      });

      controller.abort();

      await expect(abortedCaller).resolves.toEqual([
        { paperId: "101", title: "제목을 불러오지 못한 논문", folderName: "Graph Retrieval" },
      ]);
      expect(hydrationSignal?.aborted).toBe(false);
      resolveHydration?.([
        { paperId: "101", title: "Shared Episteme Title" },
      ] as unknown as HydratedPapers);
      await expect(activeCaller).resolves.toEqual([
        { paperId: "101", title: "Shared Episteme Title", folderName: "Agent Memory" },
      ]);
      expect(hydrateEpistemePapers).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("hydrates preset titles when mapped fallback titles are not displayable", async () => {
    vi.mocked(hydrateEpistemePapers).mockResolvedValueOnce([
      { paperId: "101", title: "Recovered Episteme Title" },
    ] as unknown as HydratedPapers);

    const papers = await resolveLibraryPresetPapers({
      folders: [
        {
          name: "Graph Retrieval",
          anchorCorpusIds: ["101"],
          anchorPapers: [{ paperId: "101", title: "Untitled paper" }],
        },
      ],
      neighborhood: {},
      computedAt: "2026-06-26T00:00:00Z",
    });

    expect(hydrateEpistemePapers).toHaveBeenCalledWith([101], expect.any(AbortSignal));
    expect(papers).toEqual([
      { paperId: "101", title: "Recovered Episteme Title", folderName: "Graph Retrieval" },
    ]);
  });

  it("deduplicates anchor ids across folders before rendering the list", async () => {
    const papers = await resolveLibraryPresetPapers({
      folders: [
        {
          name: "Graph Retrieval",
          anchorCorpusIds: ["101"],
          anchorPapers: [{ paperId: "101", title: "Retrieval-Augmented Agents" }],
        },
        {
          name: "Agent Memory",
          anchorCorpusIds: ["101", "202"],
          anchorPapers: [
            { paperId: "101", title: "Duplicate Agent Memory Title" },
            { paperId: "202", title: "Long-Term Memory for Agents" },
          ],
        },
      ],
      neighborhood: {},
      computedAt: "2026-06-26T00:00:00Z",
    });

    expect(papers).toEqual([
      { paperId: "101", title: "Retrieval-Augmented Agents", folderName: "Graph Retrieval" },
      { paperId: "202", title: "Long-Term Memory for Agents", folderName: "Agent Memory" },
    ]);
  });
});

describe("preset-title cache policy", () => {
  it("pins the bounded lifecycle policy", () => {
    expect(LIBRARY_ANCHOR_TITLE_CACHE_POLICY).toEqual({
      positiveTtlMs: 900_000,
      negativeTtlMs: 30_000,
      maxEntries: 1_024,
      providerTimeoutMs: 800,
    });
  });

  it("reuses a positive title until its deterministic TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
    try {
      vi.mocked(hydrateEpistemePapers)
        .mockResolvedValueOnce([
          { paperId: "101", title: "Initial Episteme Title" },
        ] as unknown as HydratedPapers)
        .mockResolvedValueOnce([
          { paperId: "101", title: "Corrected Episteme Title" },
        ] as unknown as HydratedPapers);
      const context = {
        folders: [{ name: "Graph Retrieval", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      };

      await expect(resolveLibraryPresetPapers(context)).resolves.toEqual([
        { paperId: "101", title: "Initial Episteme Title", folderName: "Graph Retrieval" },
      ]);
      await expect(resolveLibraryPresetPapers(context)).resolves.toEqual([
        { paperId: "101", title: "Initial Episteme Title", folderName: "Graph Retrieval" },
      ]);
      expect(hydrateEpistemePapers).toHaveBeenCalledTimes(1);
      expect(console.info).toHaveBeenLastCalledWith(
        "[library-anchor-display] preset-title cache observation",
        expect.objectContaining({
          cacheHitCount: 1,
          providerFillStarted: false,
        }),
      );

      vi.advanceTimersByTime(LIBRARY_ANCHOR_TITLE_CACHE_POLICY.positiveTtlMs);

      await expect(resolveLibraryPresetPapers(context)).resolves.toEqual([
        { paperId: "101", title: "Corrected Episteme Title", folderName: "Graph Retrieval" },
      ]);
      expect(hydrateEpistemePapers).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a negative title after the shorter deterministic TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
    try {
      vi.mocked(hydrateEpistemePapers)
        .mockResolvedValueOnce([] as HydratedPapers)
        .mockResolvedValueOnce([
          { paperId: "101", title: "Recovered Episteme Title" },
        ] as unknown as HydratedPapers);
      const context = {
        folders: [{ name: "Graph Retrieval", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      };

      await expect(resolveLibraryPresetPapers(context)).resolves.toEqual([
        { paperId: "101", title: "제목을 불러오지 못한 논문", folderName: "Graph Retrieval" },
      ]);
      await expect(resolveLibraryPresetPapers(context)).resolves.toEqual([
        { paperId: "101", title: "제목을 불러오지 못한 논문", folderName: "Graph Retrieval" },
      ]);
      expect(hydrateEpistemePapers).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(LIBRARY_ANCHOR_TITLE_CACHE_POLICY.negativeTtlMs);

      await expect(resolveLibraryPresetPapers(context)).resolves.toEqual([
        { paperId: "101", title: "Recovered Episteme Title", folderName: "Graph Retrieval" },
      ]);
      expect(hydrateEpistemePapers).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("preset-title shared fill", () => {
  it("coalesces concurrent misses for the same paper id into one provider fill", async () => {
    let resolveHydration: ((papers: HydratedPapers) => void) | undefined;
    vi.mocked(hydrateEpistemePapers).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHydration = resolve;
        }),
    );
    const context = {
      folders: [{ name: "Graph Retrieval", anchorCorpusIds: ["101"] }],
      neighborhood: {},
      computedAt: "2026-06-26T00:00:00Z",
    };

    const first = resolveLibraryPresetPapers(context);
    const second = resolveLibraryPresetPapers(context);
    expect(hydrateEpistemePapers).toHaveBeenCalledTimes(1);

    resolveHydration?.([
      { paperId: "101", title: "Coalesced Episteme Title" },
    ] as unknown as HydratedPapers);

    await expect(first).resolves.toEqual([
      { paperId: "101", title: "Coalesced Episteme Title", folderName: "Graph Retrieval" },
    ]);
    await expect(second).resolves.toEqual([
      { paperId: "101", title: "Coalesced Episteme Title", folderName: "Graph Retrieval" },
    ]);
  });
});

describe("preset-title cache capacity", () => {
  it("evicts the least recently used title when the bounded capacity is exceeded", async () => {
    vi.mocked(hydrateEpistemePapers).mockImplementation((corpusIds) =>
      Promise.resolve(
        corpusIds.map((corpusId) => ({
          paperId: String(corpusId),
          title: `Title ${String(corpusId)}`,
        })) as unknown as HydratedPapers,
      ),
    );
    const paperIds = Array.from(
      { length: LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries },
      (_, index) => String(index + 1),
    );
    const firstPaperId = paperIds[0];
    const secondPaperId = paperIds[1];
    const newPaperId = String(LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries + 1);
    if (!firstPaperId || !secondPaperId) throw new Error("capacity fixture is empty");

    for (let offset = 0; offset < paperIds.length; offset += 100) {
      await resolveLibraryPresetPapers({
        folders: [{ name: "Capacity", anchorCorpusIds: paperIds.slice(offset, offset + 100) }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      });
    }

    await resolveLibraryPresetPapers({
      folders: [{ name: "Capacity", anchorCorpusIds: [firstPaperId] }],
      neighborhood: {},
      computedAt: "2026-06-26T00:00:00Z",
    });
    const callsAfterPromotion = vi.mocked(hydrateEpistemePapers).mock.calls.length;
    await resolveLibraryPresetPapers({
      folders: [{ name: "Capacity", anchorCorpusIds: [newPaperId] }],
      neighborhood: {},
      computedAt: "2026-06-26T00:00:00Z",
    });

    await expect(
      resolveLibraryPresetPapers({
        folders: [
          {
            name: "Capacity",
            anchorCorpusIds: [firstPaperId, secondPaperId, newPaperId],
          },
        ],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      }),
    ).resolves.toEqual([
      { paperId: "1", title: "Title 1", folderName: "Capacity" },
      { paperId: "2", title: "Title 2", folderName: "Capacity" },
      {
        paperId: String(LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries + 1),
        title: `Title ${String(LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries + 1)}`,
        folderName: "Capacity",
      },
    ]);
    expect(hydrateEpistemePapers).toHaveBeenCalledTimes(callsAfterPromotion + 2);
    expect(hydrateEpistemePapers).toHaveBeenLastCalledWith([2], expect.any(AbortSignal));
  });

  it("removes expired entries before evicting a valid LRU title", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T00:00:00Z"));
    try {
      const validPaperId = "1";
      const newPaperId = String(LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries + 1);
      vi.mocked(hydrateEpistemePapers).mockImplementation((corpusIds) =>
        Promise.resolve(
          corpusIds
            .filter((corpusId) => corpusId === 1 || String(corpusId) === newPaperId)
            .map((corpusId) => ({
              paperId: String(corpusId),
              title: `Title ${String(corpusId)}`,
            })) as unknown as HydratedPapers,
        ),
      );

      await resolveLibraryPresetPapers({
        folders: [{ name: "Capacity", anchorCorpusIds: [validPaperId] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      });
      const negativePaperIds = Array.from(
        { length: LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries - 1 },
        (_, index) => String(index + 2),
      );
      for (let offset = 0; offset < negativePaperIds.length; offset += 100) {
        await resolveLibraryPresetPapers({
          folders: [
            {
              name: "Capacity",
              anchorCorpusIds: negativePaperIds.slice(offset, offset + 100),
            },
          ],
          neighborhood: {},
          computedAt: "2026-06-26T00:00:00Z",
        });
      }

      vi.advanceTimersByTime(LIBRARY_ANCHOR_TITLE_CACHE_POLICY.negativeTtlMs);
      await resolveLibraryPresetPapers({
        folders: [{ name: "Capacity", anchorCorpusIds: [newPaperId] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      });
      const callsAfterExpiredEntryCleanup = vi.mocked(hydrateEpistemePapers).mock.calls.length;

      await expect(
        resolveLibraryPresetPapers({
          folders: [{ name: "Capacity", anchorCorpusIds: [validPaperId, newPaperId] }],
          neighborhood: {},
          computedAt: "2026-06-26T00:00:00Z",
        }),
      ).resolves.toEqual([
        { paperId: validPaperId, title: "Title 1", folderName: "Capacity" },
        { paperId: newPaperId, title: `Title ${newPaperId}`, folderName: "Capacity" },
      ]);
      expect(hydrateEpistemePapers).toHaveBeenCalledTimes(callsAfterExpiredEntryCleanup);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("preset-title shared fill failure isolation", () => {
  it("does not cache provider failures", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      vi.mocked(hydrateEpistemePapers)
        .mockRejectedValueOnce(new Error("provider unavailable"))
        .mockResolvedValueOnce([
          { paperId: "101", title: "Recovered Episteme Title" },
        ] as unknown as HydratedPapers);
      const context = {
        folders: [{ name: "Graph Retrieval", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      };

      await expect(resolveLibraryPresetPapers(context)).resolves.toEqual([
        { paperId: "101", title: "제목을 불러오지 못한 논문", folderName: "Graph Retrieval" },
      ]);
      await expect(resolveLibraryPresetPapers(context)).resolves.toEqual([
        { paperId: "101", title: "Recovered Episteme Title", folderName: "Graph Retrieval" },
      ]);
      expect(hydrateEpistemePapers).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not cache a provider timeout", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.useFakeTimers();
    try {
      let resolveLateHydration: ((papers: HydratedPapers) => void) | undefined;
      vi.mocked(hydrateEpistemePapers)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveLateHydration = resolve;
            }),
        )
        .mockResolvedValueOnce([
          { paperId: "101", title: "Recovered Episteme Title" },
        ] as unknown as HydratedPapers);
      const context = {
        folders: [{ name: "Graph Retrieval", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      };

      const timedOut = resolveLibraryPresetPapers(context);
      await vi.advanceTimersByTimeAsync(LIBRARY_ANCHOR_TITLE_CACHE_POLICY.providerTimeoutMs);
      await expect(timedOut).resolves.toEqual([
        { paperId: "101", title: "제목을 불러오지 못한 논문", folderName: "Graph Retrieval" },
      ]);
      resolveLateHydration?.([
        { paperId: "101", title: "Late Episteme Title" },
      ] as unknown as HydratedPapers);
      vi.runAllTicks();
      await expect(resolveLibraryPresetPapers(context)).resolves.toEqual([
        { paperId: "101", title: "Recovered Episteme Title", folderName: "Graph Retrieval" },
      ]);
      expect(hydrateEpistemePapers).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      warnSpy.mockRestore();
    }
  });

  it("does not let an observation sink failure change a successful title", async () => {
    vi.mocked(console.info).mockImplementation(() => {
      throw new Error("log sink unavailable");
    });
    vi.mocked(hydrateEpistemePapers).mockResolvedValueOnce([
      { paperId: "101", title: "Observed Episteme Title" },
    ] as unknown as HydratedPapers);

    await expect(
      resolveLibraryPresetPapers({
        folders: [{ name: "Graph Retrieval", anchorCorpusIds: ["101"] }],
        neighborhood: {},
        computedAt: "2026-06-26T00:00:00Z",
      }),
    ).resolves.toEqual([
      { paperId: "101", title: "Observed Episteme Title", folderName: "Graph Retrieval" },
    ]);
  });
});

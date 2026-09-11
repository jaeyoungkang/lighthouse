import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hydrateEpistemePapers: vi.fn(),
}));

vi.mock("@/app/server/services/episteme-literature", () => ({
  hydrateEpistemePapers: mocks.hydrateEpistemePapers,
}));
vi.mock("@/app/i18n/message-access", () => ({
  t: (key: string) => key,
}));

import {
  __resetLibraryAnchorDisplayTitleCacheForTests,
  resolveLibraryPresetPapers,
} from "@/app/server/services/library-anchor-display";

interface HydratedPaper {
  paperId: string;
  title: string;
}

function deferredFill() {
  let resolve: ((papers: HydratedPaper[]) => void) | undefined;
  const promise = new Promise<HydratedPaper[]>((next) => {
    resolve = next;
  });
  return {
    promise,
    resolve(papers: HydratedPaper[]) {
      if (!resolve) throw new Error("provider resolver is unavailable");
      resolve(papers);
    },
  };
}

function context(paperId: string) {
  return {
    folders: [{ name: "Q5 Probe", anchorCorpusIds: [paperId] }],
    neighborhood: {},
    computedAt: "2026-07-17T00:00:00Z",
  };
}

function titleOf(papers: Array<{ title: string }>): string | null {
  return papers[0]?.title ?? null;
}

describe("Q5 preset-title cache observation probe", () => {
  beforeEach(() => {
    __resetLibraryAnchorDisplayTitleCacheForTests();
    mocks.hydrateEpistemePapers.mockReset();
  });

  it("coalesces same-id fills and shares the resolved title", async () => {
    const concurrentProvider = deferredFill();
    mocks.hydrateEpistemePapers.mockImplementation(() => concurrentProvider.promise as never);
    const first = resolveLibraryPresetPapers(context("101"));
    const second = resolveLibraryPresetPapers(context("101"));
    await Promise.resolve();
    const concurrentProviderCallCount = mocks.hydrateEpistemePapers.mock.calls.length;
    concurrentProvider.resolve([{ paperId: "101", title: "Shared title" }]);
    const [firstPapers, secondPapers] = await Promise.all([first, second]);

    expect(concurrentProviderCallCount).toBe(1);
    expect(titleOf(firstPapers)).toBe("Shared title");
    expect(titleOf(secondPapers)).toBe("Shared title");
  });

  it("isolates caller abort from the shared provider fill", async () => {
    const abortProvider = deferredFill();
    let providerSignalAborted = false;
    mocks.hydrateEpistemePapers.mockImplementation((_ids, signal: AbortSignal) => {
      signal.addEventListener("abort", () => {
        providerSignalAborted = true;
      });
      return abortProvider.promise as never;
    });
    const controller = new AbortController();
    const abortedCaller = resolveLibraryPresetPapers(context("202"), {
      signal: controller.signal,
    });
    const survivingCaller = resolveLibraryPresetPapers(context("202"));
    await Promise.resolve();
    const abortProviderCallCount = mocks.hydrateEpistemePapers.mock.calls.length;
    controller.abort();
    await Promise.resolve();
    abortProvider.resolve([{ paperId: "202", title: "Surviving title" }]);
    const [abortedPapers, survivingPapers] = await Promise.all([abortedCaller, survivingCaller]);

    expect(abortProviderCallCount).toBe(1);
    expect(providerSignalAborted).toBe(false);
    expect(titleOf(abortedPapers)).not.toBe("Surviving title");
    expect(titleOf(survivingPapers)).toBe("Surviving title");
  });
});

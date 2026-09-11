import { describe, expect, it } from "vitest";

import {
  inspectPresetTitleSource,
  normalizeProbeTestReport,
} from "../collect-q5-cache-lifecycle.mjs";

const SOURCE_FIXTURE = `
import { hydrateEpistemePapers } from "./episteme-literature";
export const LIBRARY_ANCHOR_TITLE_CACHE_POLICY = {
  positiveTtlMs: 15 * 60_000,
  negativeTtlMs: 30_000,
  maxEntries: 1_024,
  providerTimeoutMs: 800,
} as const;
const epistemeTitleCache = new Map<string, { title: string | null; expiresAt: number }>();
const inFlightEpistemeTitles = new Map<string, Promise<string | null>>();
function cacheEpistemeTitle(paperId: string, title: string | null) {
  epistemeTitleCache.set(paperId, {
    title,
    expiresAt:
      Date.now() +
      (title
        ? LIBRARY_ANCHOR_TITLE_CACHE_POLICY.positiveTtlMs
        : LIBRARY_ANCHOR_TITLE_CACHE_POLICY.negativeTtlMs),
  });
  while (epistemeTitleCache.size > LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries) {
    const oldestPaperId = epistemeTitleCache.keys().next().value;
    if (oldestPaperId === undefined) break;
    epistemeTitleCache.delete(oldestPaperId);
  }
}
function fill(paperId: string) {
  const cached = epistemeTitleCache.get(paperId);
  const now = Date.now();
  if (cached && cached.expiresAt <= now) epistemeTitleCache.delete(paperId);
  const inFlight = inFlightEpistemeTitles.get(paperId);
  if (inFlight) return inFlight;
  const controller = new AbortController();
  const providerDeadline = new Promise<never>((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error("provider timeout"));
      controller.abort();
    }, LIBRARY_ANCHOR_TITLE_CACHE_POLICY.providerTimeoutMs);
  });
  const result = Promise.race([
    hydrateEpistemePapers([Number(paperId)], controller.signal),
    providerDeadline,
  ])
    .then((papers) => {
      const title = papers[0]?.title ?? null;
      cacheEpistemeTitle(paperId, title);
      return title;
    })
    .catch(() => null)
    .finally(() => inFlightEpistemeTitles.delete(paperId));
  inFlightEpistemeTitles.set(paperId, result);
  return result;
}
`;

const HEALTHY_PROBE_TEST = {
  exitCode: 0,
  tests: [
    {
      assertions: [
        {
          name: "Q5 preset-title cache observation probe coalesces same-id fills and shares the resolved title",
          status: "passed",
        },
        {
          name: "Q5 preset-title cache observation probe isolates caller abort from the shared provider fill",
          status: "passed",
        },
      ],
    },
  ],
};

describe("Q5 cache lifecycle trusted normalization", () => {
  it("extracts policy values and process-local ownership from source", () => {
    expect(inspectPresetTitleSource(SOURCE_FIXTURE)).toMatchObject({
      sourceOwnerRef: "source:episteme-paper-title",
      keyRefs: ["key:public-raw-paper-id"],
      freshnessRef: "freshness:positive-900000ms-negative-30000ms",
      invalidationRefs: ["invalidation:ttl-expiry", "invalidation:lru-capacity-1024"],
      missRef: "miss:provider-fill-deadline-800ms",
      negativeResultRef: "negative:cache-null-30000ms",
      failureRef: "failure:do-not-cache-timeout-or-provider-error",
      fillControlRef: "fill:process-single-flight-per-id",
      sharingScope: "process",
      persistenceScope: "ephemeral",
    });
  });

  it("preserves changed freshness and capacity as observed facts", () => {
    const changed = SOURCE_FIXTURE.replace("15 * 60_000", "5 * 60_000").replace("1_024", "2_048");
    expect(inspectPresetTitleSource(changed)).toMatchObject({
      freshnessRef: "freshness:positive-300000ms-negative-30000ms",
      invalidationRefs: ["invalidation:ttl-expiry", "invalidation:lru-capacity-2048"],
    });
  });

  it("does not infer a provider deadline from an unused timeout constant", () => {
    const changed = SOURCE_FIXTURE.replace(
      "}, LIBRARY_ANCHOR_TITLE_CACHE_POLICY.providerTimeoutMs);",
      "}, 0);",
    );
    expect(inspectPresetTitleSource(changed).missRef).toBe("miss:unresolved");
  });

  it("does not infer LRU capacity from an empty capacity loop", () => {
    const changed = SOURCE_FIXTURE.replace(
      "    epistemeTitleCache.delete(oldestPaperId);",
      "    return;",
    );
    expect(inspectPresetTitleSource(changed).invalidationRefs).toContain(
      "invalidation:capacity-unresolved",
    );
  });

  it("does not project a missing single-flight map as healthy fill control", () => {
    const changed = SOURCE_FIXTURE.replaceAll(
      "inFlightEpistemeTitles",
      "removedInFlightMap",
    ).replace("const removedInFlightMap = new Map<string, Promise<string | null>>();", "");
    expect(inspectPresetTitleSource(changed).fillControlRef).toBe("fill:unresolved");
  });

  it("does not accept retired operations preserved only in comments", () => {
    const changed = SOURCE_FIXTURE.replace(
      'import { hydrateEpistemePapers } from "./episteme-literature";',
      "",
    )
      .replace("const inFlightEpistemeTitles = new Map<string, Promise<string | null>>();", "")
      .replaceAll("inFlightEpistemeTitles.", "removedInFlightMap.").concat(`
// import { hydrateEpistemePapers } from "./episteme-literature";
// inFlightEpistemeTitles.get(paperId);
// inFlightEpistemeTitles.set(paperId, result);
// inFlightEpistemeTitles.delete(paperId);
`);
    expect(inspectPresetTitleSource(changed)).toMatchObject({
      sourceOwnerRef: "source:unresolved",
      fillControlRef: "fill:unresolved",
    });
  });

  it("observes failure caching instead of accepting a catch-path mismatch", () => {
    const changed = SOURCE_FIXTURE.replace(
      ".catch(() => null)",
      ".catch(() => { cacheEpistemeTitle(paperId, null); return null; })",
    );
    expect(inspectPresetTitleSource(changed).failureRef).toBe("failure:unresolved");
  });

  it("normalizes collector-authority passing assertions without accepting a missing or failed probe", () => {
    expect(normalizeProbeTestReport(HEALTHY_PROBE_TEST)).toEqual({
      valid: true,
      outcomeRefs: [
        "outcome:one-provider-fill",
        "outcome:waiters-share-title",
        "outcome:caller-abort-isolated",
      ],
    });
    expect(normalizeProbeTestReport({ ...HEALTHY_PROBE_TEST, exitCode: 1 })).toEqual({
      valid: false,
      outcomeRefs: ["outcome:probe-unavailable"],
    });
    expect(normalizeProbeTestReport(null)).toEqual({
      valid: false,
      outcomeRefs: ["outcome:probe-unavailable"],
    });
  });
});

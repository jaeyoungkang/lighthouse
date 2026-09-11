import { hydrateEpistemePapers } from "./episteme-literature";
import type { LibraryContext } from "./library-context-source";
import { t } from "@/app/i18n/message-access";
import {
  indexByEpistemePaperIdentity,
  isEpisteme3PaperRef,
  lookupByEpistemePaperIdentity,
} from "@/app/lib/episteme-paper-ref";

// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-reviewed-papers-context-source

export interface LibraryPresetPaper {
  paperId: string;
  title: string;
  folderName: string;
}

const MAPPED_UNTITLED_TITLE_FALLBACK = "Untitled paper";
export const LIBRARY_ANCHOR_TITLE_CACHE_POLICY = {
  positiveTtlMs: 15 * 60_000,
  negativeTtlMs: 30_000,
  maxEntries: 1_024,
  providerTimeoutMs: 800,
} as const;

interface EpistemeTitleCacheEntry {
  title: string | null;
  expiresAt: number;
}

interface EpistemeTitleCacheLookup {
  hit: boolean;
  title: string | null;
}

const epistemeTitleCache = new Map<string, EpistemeTitleCacheEntry>();
const inFlightEpistemeTitles = new Map<string, Promise<string | null>>();
let epistemeTitleCacheEpoch = 0;

function parseCorpusId(paperId: string): number | null {
  const trimmed = paperId.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const corpusId = Number(trimmed);
  return Number.isSafeInteger(corpusId) && corpusId > 0 ? corpusId : null;
}

function isDisplayTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length > 0 && trimmed !== MAPPED_UNTITLED_TITLE_FALLBACK;
}

function collectPresetTitles(libraryContext: LibraryContext): Map<string, string> {
  const titles = new Map<string, string>();
  for (const folder of libraryContext.folders) {
    for (const paper of folder.anchorPapers ?? []) {
      const title = paper.title.trim();
      if (isDisplayTitle(title) && !titles.has(paper.paperId)) titles.set(paper.paperId, title);
    }
  }
  return titles;
}

function collectAnchorPaperIds(libraryContext: LibraryContext): string[] {
  const paperIds: string[] = [];
  const seenPaperIds = new Set<string>();
  for (const folder of libraryContext.folders) {
    for (const paperId of folder.anchorCorpusIds) {
      if (seenPaperIds.has(paperId)) continue;
      seenPaperIds.add(paperId);
      paperIds.push(paperId);
    }
  }
  return paperIds;
}

function getCachedEpistemeTitle(paperId: string, now = Date.now()): EpistemeTitleCacheLookup {
  const entry = epistemeTitleCache.get(paperId);
  if (!entry) return { hit: false, title: null };
  if (entry.expiresAt <= now) {
    epistemeTitleCache.delete(paperId);
    return { hit: false, title: null };
  }

  epistemeTitleCache.delete(paperId);
  epistemeTitleCache.set(paperId, entry);
  return { hit: true, title: entry.title };
}

function cacheEpistemeTitle(paperId: string, title: string | null, now = Date.now()): number {
  epistemeTitleCache.delete(paperId);
  epistemeTitleCache.set(paperId, {
    title,
    expiresAt:
      now +
      (title
        ? LIBRARY_ANCHOR_TITLE_CACHE_POLICY.positiveTtlMs
        : LIBRARY_ANCHOR_TITLE_CACHE_POLICY.negativeTtlMs),
  });

  if (epistemeTitleCache.size > LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries) {
    for (const [cachedPaperId, entry] of epistemeTitleCache) {
      if (entry.expiresAt <= now) epistemeTitleCache.delete(cachedPaperId);
    }
  }

  let evictedEntries = 0;
  while (epistemeTitleCache.size > LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries) {
    const oldestPaperId = epistemeTitleCache.keys().next().value;
    if (oldestPaperId === undefined) break;
    epistemeTitleCache.delete(oldestPaperId);
    evictedEntries += 1;
  }
  return evictedEntries;
}

function logTitleCacheObservation(
  level: "info" | "warn",
  message: string,
  details: Record<string, unknown>,
): void {
  try {
    const payload = { ...details, heapUsedBytes: process.memoryUsage().heapUsed };
    if (level === "warn") {
      console.warn(message, payload);
      return;
    }
    console.info(message, payload);
  } catch {
    // Diagnostics must not change preset-title success or fallback behavior.
    return;
  }
}

function startEpistemeTitleFill(
  requestedOriginalIdsByProviderRef: Map<string | number, string[]>,
): Map<string, Promise<string | null>> {
  const controller = new AbortController();
  const startedAt = Date.now();
  const cacheEpoch = epistemeTitleCacheEpoch;
  const requestedPaperCount = [...requestedOriginalIdsByProviderRef.values()].reduce(
    (count, paperIds) => count + paperIds.length,
    0,
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const providerDeadline = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new DOMException("Episteme title hydration timed out", "TimeoutError"));
      controller.abort();
    }, LIBRARY_ANCHOR_TITLE_CACHE_POLICY.providerTimeoutMs);
  });

  const batchResult = Promise.race([
    hydrateEpistemePapers([...requestedOriginalIdsByProviderRef.keys()], controller.signal),
    providerDeadline,
  ])
    .then((hydratedPapers) => {
      const hydratedByIdentity = indexByEpistemePaperIdentity(hydratedPapers);
      const titleByOriginalPaperId = new Map<string, string | null>();
      let evictedEntries = 0;

      for (const [providerRef, originalIds] of requestedOriginalIdsByProviderRef) {
        const hydrated = lookupByEpistemePaperIdentity(hydratedByIdentity, providerRef);
        const title = hydrated && isDisplayTitle(hydrated.title) ? hydrated.title.trim() : null;
        for (const paperId of originalIds) {
          titleByOriginalPaperId.set(paperId, title);
          if (cacheEpoch === epistemeTitleCacheEpoch) {
            evictedEntries += cacheEpistemeTitle(paperId, title);
          }
        }
      }

      logTitleCacheObservation(
        "info",
        "[library-anchor-display] Episteme title hydration completed",
        {
          durationMs: Date.now() - startedAt,
          requestedPaperCount,
          resolvedTitleCount: [...titleByOriginalPaperId.values()].filter(Boolean).length,
          negativeTitleCount: [...titleByOriginalPaperId.values()].filter((title) => !title).length,
          cacheEntryCount: epistemeTitleCache.size,
          cacheCapacity: LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries,
          evictedEntries,
        },
      );
      return titleByOriginalPaperId;
    })
    .catch((error: unknown) => {
      logTitleCacheObservation("warn", "[library-anchor-display] Episteme title hydration failed", {
        failureKind:
          error instanceof DOMException && error.name === "TimeoutError"
            ? "provider_timeout"
            : "provider_failure",
        durationMs: Date.now() - startedAt,
        requestedPaperCount,
        cacheEntryCount: epistemeTitleCache.size,
        cacheCapacity: LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries,
      });
      throw error;
    })
    .finally(() => {
      if (timeout) clearTimeout(timeout);
    });

  const resolutions = new Map<string, Promise<string | null>>();
  for (const originalIds of requestedOriginalIdsByProviderRef.values()) {
    for (const paperId of originalIds) {
      const resolution = batchResult
        .then((titleByOriginalPaperId) => titleByOriginalPaperId.get(paperId) ?? null)
        .finally(() => {
          if (inFlightEpistemeTitles.get(paperId) === resolution) {
            inFlightEpistemeTitles.delete(paperId);
          }
        });
      inFlightEpistemeTitles.set(paperId, resolution);
      resolutions.set(paperId, resolution);
    }
  }
  return resolutions;
}

async function waitForTitleResolutions(
  resolutions: Map<string, Promise<string | null>>,
  signal?: AbortSignal,
): Promise<Array<{ paperId: string; title: string | null; fulfilled: boolean }> | null> {
  const settled = Promise.all(
    [...resolutions].map(async ([paperId, resolution]) => {
      try {
        return { paperId, title: await resolution, fulfilled: true };
      } catch {
        return { paperId, title: null, fulfilled: false };
      }
    }),
  );
  if (!signal) return settled;
  if (signal.aborted) return null;

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<null>((resolve) => {
    onAbort = () => {
      resolve(null);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([settled, aborted]);
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}

function collectPendingTitleResolutions(
  paperIds: string[],
  titlesByPaperId: Map<string, string>,
): {
  requestedOriginalIdsByProviderRef: Map<string | number, string[]>;
  resolutions: Map<string, Promise<string | null>>;
  cacheHitCount: number;
  coalescedHitCount: number;
} {
  const requestedOriginalIdsByProviderRef = new Map<string | number, string[]>();
  const resolutions = new Map<string, Promise<string | null>>();
  let cacheHitCount = 0;
  let coalescedHitCount = 0;

  for (const paperId of paperIds) {
    if (titlesByPaperId.has(paperId)) continue;
    const cachedTitle = getCachedEpistemeTitle(paperId);
    if (cachedTitle.hit) {
      cacheHitCount += 1;
      if (cachedTitle.title) titlesByPaperId.set(paperId, cachedTitle.title);
      continue;
    }
    const inFlightTitle = inFlightEpistemeTitles.get(paperId);
    if (inFlightTitle) {
      coalescedHitCount += 1;
      resolutions.set(paperId, inFlightTitle);
      continue;
    }
    const corpusId = parseCorpusId(paperId);
    const providerRef = corpusId ?? (isEpisteme3PaperRef(paperId) ? paperId.trim() : null);
    if (providerRef == null) continue;
    const originalIds = requestedOriginalIdsByProviderRef.get(providerRef) ?? [];
    originalIds.push(paperId);
    requestedOriginalIdsByProviderRef.set(providerRef, originalIds);
  }

  return {
    requestedOriginalIdsByProviderRef,
    resolutions,
    cacheHitCount,
    coalescedHitCount,
  };
}

async function fillMissingTitlesFromEpisteme(
  paperIds: string[],
  titlesByPaperId: Map<string, string>,
  options?: { signal?: AbortSignal },
): Promise<void> {
  const startedAt = Date.now();
  const { requestedOriginalIdsByProviderRef, resolutions, cacheHitCount, coalescedHitCount } =
    collectPendingTitleResolutions(paperIds, titlesByPaperId);

  if (options?.signal?.aborted) return;
  if (requestedOriginalIdsByProviderRef.size > 0) {
    for (const [paperId, resolution] of startEpistemeTitleFill(requestedOriginalIdsByProviderRef)) {
      resolutions.set(paperId, resolution);
    }
  }
  const results =
    resolutions.size > 0
      ? await waitForTitleResolutions(resolutions, options?.signal)
      : ([] as Array<{ paperId: string; title: string | null; fulfilled: boolean }>);
  if (results) {
    for (const result of results) {
      if (result.fulfilled && result.title) titlesByPaperId.set(result.paperId, result.title);
    }
  }

  if (resolutions.size + cacheHitCount === 0) return;

  logTitleCacheObservation("info", "[library-anchor-display] preset-title cache observation", {
    durationMs: Date.now() - startedAt,
    requestedPaperCount: resolutions.size + cacheHitCount,
    cacheHitCount,
    coalescedHitCount,
    providerMissCount: [...requestedOriginalIdsByProviderRef.values()].reduce(
      (count, originalIds) => count + originalIds.length,
      0,
    ),
    providerFillStarted: requestedOriginalIdsByProviderRef.size > 0,
    callerAborted: results === null,
    cacheEntryCount: epistemeTitleCache.size,
    cacheCapacity: LIBRARY_ANCHOR_TITLE_CACHE_POLICY.maxEntries,
  });
}

export async function resolveLibraryPresetPapers(
  libraryContext: LibraryContext | null,
  options?: { signal?: AbortSignal },
): Promise<LibraryPresetPaper[]> {
  if (!libraryContext) return [];

  const titlesByPaperId = collectPresetTitles(libraryContext);
  const anchorPaperIds = collectAnchorPaperIds(libraryContext);
  await fillMissingTitlesFromEpisteme(anchorPaperIds, titlesByPaperId, options);
  const seenPaperIds = new Set<string>();
  const papers: LibraryPresetPaper[] = [];

  for (const folder of libraryContext.folders) {
    for (const paperId of folder.anchorCorpusIds) {
      if (seenPaperIds.has(paperId)) continue;
      seenPaperIds.add(paperId);
      papers.push({
        paperId,
        title:
          titlesByPaperId.get(paperId) ??
          t("search.label.research-route-search-bar.libraryList.unknownPaperTitle"),
        folderName: folder.name,
      });
    }
  }

  return papers;
}

export function __resetLibraryAnchorDisplayTitleCacheForTests(): void {
  epistemeTitleCacheEpoch += 1;
  epistemeTitleCache.clear();
  inFlightEpistemeTitles.clear();
}

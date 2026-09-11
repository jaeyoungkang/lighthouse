// Reproduce one first-session user's search journey against a running Light
// House server, carrying the synthetic session cookie on every request. Every
// request is wrapped in an AbortController timeout so a hung call is recorded as
// "timeout" rather than stalling the cohort.
//
// Sequence (verified against the route handlers, query-canonical search model):
//   1. GET  /search                                   (authenticated RSC render)
//   2. GET  /search?q=<query>&entry=route-bar         provider execution in-place
//   3. GET  /search?q=<term>&entry=term&termSeed...   seeded follow-up execution

import {
  ENDPOINT_LABELS,
  classifyOutcome,
  parseServerTiming,
  type JourneyContext,
  type RequestRecord,
  type UserJourneyResult,
} from "./metrics";

interface RequestOptions {
  method: "GET" | "POST";
  body?: unknown;
  parseJson?: boolean;
  /** "manual" captures a redirect response instead of following it. */
  redirect?: "manual";
}

interface FetchResult {
  record: RequestRecord;
  json: unknown;
  text: string | null;
}

export function readSearchPaperIds(
  outcome: RequestRecord["outcome"],
  html: string | null,
): string[] | null {
  if (outcome !== "2xx") return null;

  const paperIds: string[] = [];
  const seen = new Set<string>();
  for (const match of html?.matchAll(/\bdata-paper-id="([^"]*)"/g) ?? []) {
    const paperId = match[1];
    if (seen.has(paperId)) continue;
    seen.add(paperId);
    paperIds.push(paperId);
  }
  return paperIds;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

async function timedFetch(
  ctx: JourneyContext,
  endpoint: string,
  requestPath: string,
  options: RequestOptions,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, ctx.timeoutMs);
  const startOffsetMs = performance.now() - ctx.cohortStartedAt;
  const startedAt = performance.now();
  const headers: Record<string, string> = { cookie: ctx.cookie };
  const redirectMode = options.redirect ?? "follow";
  if (options.method === "POST") headers["content-type"] = "application/json";

  try {
    const response = await fetch(`${ctx.baseUrl}${requestPath}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      redirect: redirectMode,
    });
    const text = await response.text();
    const latencyMs = performance.now() - startedAt;
    const serverTiming = parseServerTiming(response.headers.get("server-timing"));
    const record: RequestRecord = {
      endpoint,
      userIndex: ctx.userIndex,
      outcome: classifyOutcome(response.status),
      status: response.status,
      latencyMs,
      startOffsetMs,
      method: options.method,
      requestPath,
      finalUrl: response.url,
      redirectMode,
    };
    if (Object.keys(serverTiming).length > 0) record.serverTiming = serverTiming;
    return {
      record,
      json: options.parseJson === true ? JSON.parse(text) : null,
      text,
    };
  } catch (error) {
    const record: RequestRecord = {
      endpoint,
      userIndex: ctx.userIndex,
      outcome: isAbortError(error) ? "timeout" : "network-error",
      status: null,
      latencyMs: performance.now() - startedAt,
      startOffsetMs,
      method: options.method,
      requestPath,
      finalUrl: null,
      redirectMode,
    };
    return { record, json: null, text: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Run one synthetic user's full first-session search journey. */
export async function runUserJourney(ctx: JourneyContext): Promise<UserJourneyResult> {
  const records: RequestRecord[] = [];

  const searchPage = await timedFetch(ctx, ENDPOINT_LABELS.searchPage, "/search", {
    method: "GET",
  });
  records.push(searchPage.record);

  const entryParams = new URLSearchParams({ q: ctx.query, entry: "route-bar" });
  const querySearch = await timedFetch(
    ctx,
    ENDPOINT_LABELS.querySearch,
    `/search?${entryParams.toString()}`,
    {
      method: "GET",
    },
  );
  records.push(querySearch.record);

  // 연구 용어 클릭 hot path: the seeded follow-up query URL is the interactive
  // transition this rail regression-anchors after the 2026-07 latency incident.
  const followupParams = new URLSearchParams({
    q: `${ctx.query} methods`,
    entry: "term",
    termSourceQuery: ctx.query,
    term: `${ctx.query} methods`,
    termType: "direct",
    termSupport: "1",
  });
  const followupEntry = await timedFetch(
    ctx,
    ENDPOINT_LABELS.followupEntry,
    `/search?${followupParams.toString()}`,
    { method: "GET" },
  );
  records.push(followupEntry.record);

  const paperIds = readSearchPaperIds(querySearch.record.outcome, querySearch.text);

  return {
    userIndex: ctx.userIndex,
    documentId: null,
    paperIds,
    records,
  };
}

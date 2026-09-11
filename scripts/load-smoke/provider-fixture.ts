import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { SEARCH_DOCUMENT_FETCH_LIMIT } from "../../app/lib/constants";

export const PROVIDER_FIXTURE_HOST = "127.0.0.1";
export const DEFAULT_PROVIDER_FIXTURE_PORT = 43_123;
export const DEFAULT_PROVIDER_DELAY_MS = 350;
export const DEFAULT_PROVIDER_PAPER_COUNT = 3;
export const MAX_PROVIDER_FIXTURE_REQUEST_BODY_BYTES = 64 * 1024;
export const MAX_PROVIDER_PAPER_COUNT = SEARCH_DOCUMENT_FETCH_LIMIT;

export const PROVIDER_FIXTURE_PROFILES = ["healthy", "delay", "429", "500"] as const;

export type ProviderFixtureProfile = (typeof PROVIDER_FIXTURE_PROFILES)[number];

export interface ProviderFixtureOptions {
  profile: ProviderFixtureProfile;
  delayMs?: number;
  paperCount?: number;
}

export interface ProviderFixtureCliOptions extends ProviderFixtureOptions {
  port: number;
  paperCount: number;
  help: boolean;
}

export interface ProviderFixtureStats {
  profile: ProviderFixtureProfile;
  configuredDelayMs: number;
  configuredPaperCount: number;
  searchRequests: number;
  inFlight: number;
  maxInFlight: number;
  responses: {
    success: number;
    rateLimited: number;
    serverError: number;
  };
}

export interface LoadSmokeProviderFixture {
  server: Server;
  snapshotStats(): ProviderFixtureStats;
}

function parsePositiveInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function parseProfile(value: string | undefined): ProviderFixtureProfile {
  if (value === undefined || !PROVIDER_FIXTURE_PROFILES.includes(value as ProviderFixtureProfile)) {
    throw new Error(
      `--profile must be one of ${PROVIDER_FIXTURE_PROFILES.map((profile) => `'${profile}'`).join(
        ", ",
      )}`,
    );
  }
  return value as ProviderFixtureProfile;
}

export function parseProviderFixtureArgs(args: string[]): ProviderFixtureCliOptions {
  let profile: ProviderFixtureProfile = "healthy";
  let port = DEFAULT_PROVIDER_FIXTURE_PORT;
  let delayMs = DEFAULT_PROVIDER_DELAY_MS;
  let paperCount = DEFAULT_PROVIDER_PAPER_COUNT;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }
    if (arg === "--profile") {
      profile = parseProfile(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--port") {
      port = parsePositiveInteger(args[index + 1], "--port");
      if (port > 65_535) throw new Error("--port must be at most 65535");
      index += 1;
      continue;
    }
    if (arg === "--delay-ms") {
      delayMs = parseNonNegativeInteger(args[index + 1], "--delay-ms");
      index += 1;
      continue;
    }
    if (arg === "--paper-count") {
      paperCount = parsePositiveInteger(args[index + 1], "--paper-count");
      if (paperCount > MAX_PROVIDER_PAPER_COUNT) {
        throw new Error(`--paper-count must be at most ${String(MAX_PROVIDER_PAPER_COUNT)}`);
      }
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return { profile, port, delayMs, paperCount, help };
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

/**
 * Keep the controlled corpus stable for one query while making query forwarding
 * observable in the rendered paper identities. This is fixture identity only;
 * it is not evidence that a real provider supports an identifier format.
 */
export function getProviderFixturePaperId(query: string, index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PROVIDER_PAPER_COUNT) {
    throw new Error(
      `provider fixture paper index must be an integer between 0 and ${String(MAX_PROVIDER_PAPER_COUNT - 1)}`,
    );
  }

  let hash = 2_166_136_261;
  for (let position = 0; position < query.length; position += 1) {
    hash ^= query.charCodeAt(position);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  const queryBase = 1_000_000 + (hash % 1_000_000) * 100;
  return queryBase + index;
}

function buildPaperCard(query: string, index: number, projection: string) {
  const id = getProviderFixturePaperId(query, index);
  return {
    paper_uid: `pap_fixture_${String(id)}`,
    projection,
    omitted_fields: projection === "rich" ? [] : ["abstract"],
    title: `Fixture Paper ${String(index + 1)}: ${query}`,
    abstract: projection === "rich" ? `Fixture abstract ${String(index + 1)}` : null,
    abstract_snippet: null,
    publication_year: 2024 - (index % 10),
    venue: { name: "Fixture Venue" },
    publication_venue: "Fixture Venue",
    authors: [],
    fields_of_study: ["Computer Science"],
    identifiers: [{ namespace: "s2_corpus_id", value: String(id) }],
    source_memberships: ["fixture"],
    has_pdf: false,
    has_open_access_location: false,
    access_url: `https://example.test/papers/${String(id)}`,
    best_open_pdf: null,
    best_landing_page: `https://example.test/papers/${String(id)}`,
    citation_count: Math.max(0, MAX_PROVIDER_PAPER_COUNT - index),
    reference_count: 0,
    relevance: Math.max(0, 1 - index / Math.max(1, MAX_PROVIDER_PAPER_COUNT)),
    currency: { generation: 1, state: "current" },
  };
}

function buildHealthySearchResponse(body: Record<string, unknown>, paperCount: number) {
  const queryRecord = body.query as Record<string, unknown> | undefined;
  const pageRecord = body.page as Record<string, unknown> | undefined;
  const query = typeof queryRecord?.text === "string" ? queryRecord.text : "";
  const requestedSize = pageRecord?.size;
  const limit =
    typeof requestedSize === "number" && Number.isInteger(requestedSize) && requestedSize > 0
      ? Math.min(requestedSize, MAX_PROVIDER_PAPER_COUNT)
      : paperCount;
  const projection =
    body.projection === "compact" || body.projection === "rich" ? body.projection : "standard";
  const itemCount = Math.min(limit, paperCount);
  const items = Array.from({ length: itemCount }, (_unused, index) => ({
    ...buildPaperCard(query, index, projection),
  }));

  return {
    items,
    next_cursor: null,
    total: {
      value: paperCount,
      relation: "exact",
      basis: "lexical_matches",
      coverage: { generation: "1", indexed: paperCount, eligible: paperCount, full: true },
      incomplete_reasons: [],
    },
    counts: [],
    facets: [],
    coverage: {
      paper: { generation: "1", indexed: paperCount, eligible: paperCount, full: true },
    },
    currency: { state: "current", retrieval_generation: "1", projection_generations: [1] },
    elapsed_ms: 1,
    page: { generation: "1", next_cursor: null, size: items.length },
    completeness: {
      status: "complete",
      generations: { retrieval: "1", projection: "1" },
      indexed: paperCount,
      eligible: paperCount,
      incomplete_reasons: [],
    },
  };
}

async function readJsonObject(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    receivedBytes += buffer.byteLength;
    if (receivedBytes > MAX_PROVIDER_FIXTURE_REQUEST_BODY_BYTES) {
      throw new ProviderFixtureBodyTooLargeError();
    }
    chunks.push(buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("provider fixture request body must be an object");
  }
  return parsed as Record<string, unknown>;
}

class ProviderFixtureBodyTooLargeError extends Error {}

export function createLoadSmokeProviderFixture(
  options: ProviderFixtureOptions,
): LoadSmokeProviderFixture {
  const configuredDelayMs = options.delayMs ?? DEFAULT_PROVIDER_DELAY_MS;
  if (!Number.isInteger(configuredDelayMs) || configuredDelayMs < 0) {
    throw new Error("delayMs must be a non-negative integer");
  }
  const configuredPaperCount = options.paperCount ?? DEFAULT_PROVIDER_PAPER_COUNT;
  if (
    !Number.isInteger(configuredPaperCount) ||
    configuredPaperCount <= 0 ||
    configuredPaperCount > MAX_PROVIDER_PAPER_COUNT
  ) {
    throw new Error(
      `paperCount must be an integer between 1 and ${String(MAX_PROVIDER_PAPER_COUNT)}`,
    );
  }

  const stats: ProviderFixtureStats = {
    profile: options.profile,
    configuredDelayMs,
    configuredPaperCount,
    searchRequests: 0,
    inFlight: 0,
    maxInFlight: 0,
    responses: { success: 0, rateLimited: 0, serverError: 0 },
  };

  const snapshotStats = (): ProviderFixtureStats => structuredClone(stats);
  const handleRequest = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", `http://${PROVIDER_FIXTURE_HOST}`);
    if (request.method === "GET" && url.pathname === "/__stats") {
      writeJson(response, 200, snapshotStats());
      return;
    }
    if (request.method !== "POST" || url.pathname !== "/api/v3/search/papers") {
      writeJson(response, 404, { error: "not found" });
      return;
    }

    stats.searchRequests += 1;
    stats.inFlight += 1;
    stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
    try {
      if (options.profile === "delay") await sleep(configuredDelayMs);
      if (options.profile === "429") {
        stats.responses.rateLimited += 1;
        writeJson(response, 429, { error: "controlled 429" });
        return;
      }
      if (options.profile === "500") {
        stats.responses.serverError += 1;
        writeJson(response, 500, { error: "controlled 500" });
        return;
      }

      const requestBody = await readJsonObject(request);
      stats.responses.success += 1;
      writeJson(response, 200, buildHealthySearchResponse(requestBody, configuredPaperCount));
    } catch (error) {
      stats.responses.serverError += 1;
      if (!response.headersSent) {
        if (error instanceof ProviderFixtureBodyTooLargeError) {
          response.setHeader("connection", "close");
          writeJson(response, 413, { error: "fixture request body too large" });
        } else {
          writeJson(response, 500, { error: "fixture request failed" });
        }
        return;
      }
      throw error;
    } finally {
      stats.inFlight -= 1;
    }
  };
  const server = createServer((request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      if (!response.headersSent) {
        writeJson(response, 500, { error: "fixture request failed" });
        return;
      }
      response.destroy(error instanceof Error ? error : undefined);
    });
  });

  return { server, snapshotStats };
}

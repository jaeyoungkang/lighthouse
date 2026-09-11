/**
 * Library-grounded research — runtime injection seam.
 *
 * The default inbound source is the current user's internal `reviewed_papers`
 * library. Moonlight Scholar and the old cohort pilot file/env source remain
 * compatibility sources behind `LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED=1`.
 *
 * Sources, in precedence order:
 *   1. `reviewed_papers` for the authenticated Light House user.
 *   2. `MOONLIGHT_SCHOLAR_API_BASE_URL` + the short-lived Moonlight Scholar
 *      session token stored by `MoonlightAuthBootstrap`, when compatibility is enabled.
 *   3. `LIBRARY_CONTEXT_JSON` env var holding the old email-keyed JSON inline.
 *   4. a local file at `LIBRARY_CONTEXT_PILOT_PATH` (default `pilot/library-context.json`).
 *
 * @aspect aspect:library-grounded-research
 * @check acceptance-check:search-results-fast-window-library-source-sync
 */
import { z } from "zod";
import { normalizeEmail } from "@/app/lib/email";
import { isEpisteme3PaperRef } from "@/app/lib/episteme-paper-ref";
import { t } from "@/app/i18n/message-access";
import {
  getMoonlightScholarSessionTokenFromCookies,
  verifyMoonlightScholarToken,
} from "@/app/server/auth/moonlight-scholar-token";
import {
  fetchMoonlightScholarLibraryPage,
  runWithMoonlightScholarLibraryDeadline,
} from "@/app/server/external-http-gateway/moonlight-scholar-library-fetch";

/** Per-reader library anchor display metadata. Server-runtime only. */
export interface LibraryAnchorPaper {
  paperId: string;
  title: string;
}

export interface LibraryContextFolder {
  name: string;
  anchorCorpusIds: string[];
  /** Optional display metadata for library anchors. */
  anchorPapers?: LibraryAnchorPaper[];
}

export interface LibraryContext {
  /** Coherent collections that anchored the neighborhood, for grounding/basis. */
  folders: LibraryContextFolder[];
  /** corpus_id (== Episteme paperId) → interest weight. Higher = nearer the library. */
  neighborhood: Record<string, number>;
  /** ISO-8601 timestamp of the source read or compatibility precompute run. */
  computedAt: string;
}

export type LibraryContextAccessStatus =
  | "available"
  | "unavailable"
  | "moonlight_scholar_access_not_allowed"
  | "moonlight_scholar_session_invalid";

export interface LibraryContextResolution {
  context: LibraryContext | null;
  accessStatus: LibraryContextAccessStatus;
}

export interface LibraryContextReviewedPaper {
  paperId: string;
  title: string;
}

export interface LibraryContextUserSource {
  reviewedPapers: readonly LibraryContextReviewedPaper[];
}

type ContextStore = Record<string, LibraryContext>;
type LiveLibraryContextResult =
  | { status: "available"; context: LibraryContext }
  | { status: "source_absent" }
  | { status: "unavailable" }
  | { status: "access_not_allowed" }
  | { status: "token_invalid" };

// undefined = not yet loaded; null store = absent / unreadable / invalid (degrade).
// File-backed local dev sources include a content hash so a server process that
// first saw a missing/stale pilot file can pick up same-size rewrites without restart.
let cached: { sourceKey: string; store: ContextStore | null } | undefined;

const DEFAULT_PILOT_PATH = "pilot/library-context.json";
const DEFAULT_LIVE_LIBRARY_FOLDER_NAME = "Moonlight Library";
const INTERNAL_REVIEWED_LIBRARY_FOLDER_NAME = t(
  "search.label.library-context-source.internalReviewedFolder",
);
const MOONLIGHT_LIBRARY_PAGE_LIMIT = 100;
export const MOONLIGHT_LIBRARY_MAX_PAPERS = 2_000;
const LIBRARY_GROUNDING_ENABLED_ENV = "LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED";

const moonlightLibraryPaperSchema = z
  .object({
    title: z.string().nullish(),
    identifiers: z
      .object({
        corpusId: z.union([z.string(), z.number()]).nullish(),
      })
      .catchall(z.unknown()),
    tags: z.array(z.string()).optional().default([]),
  })
  .catchall(z.unknown());

const moonlightLibraryResponseSchema = z.object({
  papers: z.array(moonlightLibraryPaperSchema),
  nextCursor: z.string().nullable(),
});

type MoonlightLibraryPaper = z.infer<typeof moonlightLibraryPaperSchema>;

class MoonlightScholarLibraryApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "MoonlightScholarLibraryApiError";
  }
}

function resolvePilotPath(): string {
  const override = process.env.LIBRARY_CONTEXT_PILOT_PATH?.trim();
  return override || DEFAULT_PILOT_PATH;
}

function shouldReadPilotFile(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    (process.env.LIBRARY_CONTEXT_PILOT_PATH?.trim().length ?? 0) > 0
  );
}

function isValidAnchorPaper(value: unknown): value is LibraryAnchorPaper {
  if (!value || typeof value !== "object") return false;
  const paper = value as Record<string, unknown>;
  return typeof paper.paperId === "string" && typeof paper.title === "string";
}

function isValidFolder(value: unknown): value is LibraryContextFolder {
  if (!value || typeof value !== "object") return false;
  const folder = value as Record<string, unknown>;
  return (
    typeof folder.name === "string" &&
    Array.isArray(folder.anchorCorpusIds) &&
    folder.anchorCorpusIds.every((id) => typeof id === "string") &&
    (folder.anchorPapers === undefined ||
      (Array.isArray(folder.anchorPapers) && folder.anchorPapers.every(isValidAnchorPaper)))
  );
}

function isValidContext(value: unknown): value is LibraryContext {
  if (!value || typeof value !== "object") return false;
  const ctx = value as Record<string, unknown>;
  // Validate the nested shape, not just top-level keys: a partially malformed
  // context (bad folder element, non-number weight) must degrade to null rather
  // than reach the search path and break the prompt/blend downstream.
  return (
    Array.isArray(ctx.folders) &&
    ctx.folders.every(isValidFolder) &&
    typeof ctx.neighborhood === "object" &&
    ctx.neighborhood !== null &&
    Object.values(ctx.neighborhood as Record<string, unknown>).every(
      (w) => typeof w === "number",
    ) &&
    typeof ctx.computedAt === "string"
  );
}

function cacheParsedStore(raw: string, sourceKey: string): ContextStore | null {
  if (cached?.sourceKey === sourceKey) return cached.store;
  try {
    const parsed: unknown = JSON.parse(raw);
    const store = parsed && typeof parsed === "object" ? (parsed as ContextStore) : null;
    cached = { sourceKey, store };
  } catch {
    // Malformed JSON → no signal until the source content changes.
    cached = { sourceKey, store: null };
  }
  return cached.store;
}

async function loadStore(): Promise<ContextStore | null> {
  // Deploy-friendly source resolution: serverless hosts (Vercel) have a
  // read-only filesystem and `pilot/` is gitignored, so prefer an inline
  // `LIBRARY_CONTEXT_JSON` env var when present; fall back to the local file
  // for dev. Either way the runtime only reads precomputed context.
  const inline = process.env.LIBRARY_CONTEXT_JSON?.trim();
  if (inline) return cacheParsedStore(inline, `env:${inline}`);
  if (!shouldReadPilotFile()) {
    cached = undefined;
    return null;
  }

  const pilotPath = resolvePilotPath();
  const { readLibraryContextFile } = await import("./library-context-file-source");
  const snapshot = await readLibraryContextFile(pilotPath);
  if (!snapshot) {
    // Missing/unreadable file → no signal, but do not pin that state forever in
    // local dev; a later lookup should see a newly created pilot file.
    cached = undefined;
    return null;
  }
  return cacheParsedStore(snapshot.raw, snapshot.sourceKey);
}

/**
 * Returns the library context for the reader, or null when no signal exists
 * (Moonlight API unavailable, no token, no marked corpus ids, file absent,
 * email not in the compatibility cohort map, malformed entry). A null return is
 * the honest "no signal -> default search" degrade path.
 */
export async function getLibraryContextForUser(
  email: string | null | undefined,
  userSource?: LibraryContextUserSource,
): Promise<LibraryContext | null> {
  return (await resolveLibraryContextForUser(email, userSource)).context;
}

export async function resolveLibraryContextForUser(
  email: string | null | undefined,
  userSource?: LibraryContextUserSource,
  options?: { signal?: AbortSignal },
): Promise<LibraryContextResolution> {
  if (options?.signal?.aborted) return { context: null, accessStatus: "unavailable" };
  const reviewedContext = userSource
    ? getReviewedPapersLibraryContext(userSource.reviewedPapers)
    : null;
  if (reviewedContext) {
    return { context: reviewedContext, accessStatus: "available" };
  }

  if (!isLibraryGroundingEnabled()) return { context: null, accessStatus: "unavailable" };
  if (!email) return { context: null, accessStatus: "unavailable" };
  const normalizedEmail = normalizeEmail(email);
  const liveContext = await getLiveMoonlightLibraryContext(normalizedEmail, options);
  if (liveContext.status === "available") {
    return { context: liveContext.context, accessStatus: "available" };
  }
  if (liveContext.status === "access_not_allowed") {
    return { context: null, accessStatus: "moonlight_scholar_access_not_allowed" };
  }
  if (liveContext.status === "token_invalid") {
    return { context: null, accessStatus: "moonlight_scholar_session_invalid" };
  }
  if (liveContext.status === "unavailable") {
    return { context: null, accessStatus: "unavailable" };
  }

  const staticContext = await getStaticLibraryContextForUser(normalizedEmail);
  return {
    context: staticContext,
    accessStatus: staticContext ? "available" : "unavailable",
  };
}

export function getReviewedPapersLibraryContext(
  reviewedPapers: readonly LibraryContextReviewedPaper[],
): LibraryContext | null {
  const anchorCorpusIds: string[] = [];
  const anchorPapers: LibraryAnchorPaper[] = [];
  const seenCorpusIds = new Set<string>();

  for (const paper of reviewedPapers) {
    const paperRef = normalizeReviewedPaperRef(paper.paperId);
    if (!paperRef || seenCorpusIds.has(paperRef)) continue;
    seenCorpusIds.add(paperRef);
    anchorCorpusIds.push(paperRef);
    anchorPapers.push({
      paperId: paperRef,
      title: paper.title.trim() || "Untitled paper",
    });
  }

  if (anchorCorpusIds.length === 0) return null;

  return {
    folders: [
      {
        name: INTERNAL_REVIEWED_LIBRARY_FOLDER_NAME,
        anchorCorpusIds,
        anchorPapers,
      },
    ],
    neighborhood: {},
    computedAt: new Date().toISOString(),
  };
}

export function isLibraryGroundingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[LIBRARY_GROUNDING_ENABLED_ENV] === "1";
}

async function getStaticLibraryContextForUser(
  email: string | null | undefined,
): Promise<LibraryContext | null> {
  if (!email) return null;
  const store = await loadStore();
  if (!store) return null;
  const entry = store[normalizeEmail(email)];
  return isValidContext(entry) ? entry : null;
}

export function filterLibraryContextByAnchorPaperIds(
  libraryContext: LibraryContext | null,
  libraryPaperIds: readonly string[] | undefined,
): LibraryContext | null {
  if (!libraryContext) return null;
  if (!libraryPaperIds) return libraryContext;
  const selectedIds = new Set(libraryPaperIds);
  return {
    ...libraryContext,
    folders: libraryContext.folders
      .map((folder) => ({
        ...folder,
        anchorCorpusIds: folder.anchorCorpusIds.filter((paperId) => selectedIds.has(paperId)),
        ...(folder.anchorPapers
          ? {
              anchorPapers: folder.anchorPapers.filter((paper) => selectedIds.has(paper.paperId)),
            }
          : {}),
      }))
      .filter((folder) => folder.anchorCorpusIds.length > 0),
  };
}

/** Test-only: clears the module cache so a different fixture path can load. */
export function __resetLibraryContextCacheForTests(): void {
  cached = undefined;
}

async function getLiveMoonlightLibraryContext(
  expectedEmail: string,
  options?: { signal?: AbortSignal },
): Promise<LiveLibraryContextResult> {
  if (options?.signal?.aborted) return { status: "unavailable" };
  const baseUrl = resolveMoonlightScholarApiBaseUrl();
  if (!baseUrl) return { status: "source_absent" };

  const token = await getMoonlightScholarSessionTokenFromCookies();
  if (!token) return { status: "source_absent" };

  try {
    const tokenUser = verifyMoonlightScholarToken(token);
    if (normalizeEmail(tokenUser.email) !== expectedEmail) {
      return { status: "token_invalid" };
    }
  } catch {
    return { status: "token_invalid" };
  }

  try {
    const papers = await runWithMoonlightScholarLibraryDeadline({
      signal: options?.signal,
      operation: (signal) =>
        fetchMoonlightScholarLibraryPapers({
          baseUrl,
          token,
          signal,
        }),
    });
    const context = mapMoonlightLibraryPapersToContext(papers);
    return context ? { status: "available", context } : { status: "unavailable" };
  } catch (error) {
    if (
      error instanceof MoonlightScholarLibraryApiError &&
      (error.status === 403 || error.code === "MOONLIGHT_SCHOLAR_ACCESS_NOT_ALLOWED")
    ) {
      return { status: "access_not_allowed" };
    }
    if (
      error instanceof MoonlightScholarLibraryApiError &&
      (error.status === 401 ||
        error.code === "MOONLIGHT_SCHOLAR_TOKEN_INVALID" ||
        error.code === "MOONLIGHT_SCHOLAR_TOKEN_REQUIRED")
    ) {
      return { status: "token_invalid" };
    }
    console.warn("[library-context-source] Moonlight Scholar library fetch failed", {
      errorName: error instanceof Error ? error.name : String(error),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { status: "unavailable" };
  }
}

function resolveMoonlightScholarApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw =
    env.MOONLIGHT_SCHOLAR_API_BASE_URL?.trim() ||
    env.NEXT_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function fetchMoonlightScholarLibraryPapers(params: {
  readonly baseUrl: string;
  readonly token: string;
  readonly limit?: number;
  readonly maxPapers?: number;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<MoonlightLibraryPaper[]> {
  const limit = params.limit ?? MOONLIGHT_LIBRARY_PAGE_LIMIT;
  const maxPapers = params.maxPapers ?? MOONLIGHT_LIBRARY_MAX_PAPERS;
  let papers: MoonlightLibraryPaper[] = [];
  let cursor: string | null = null;
  let droppedInvalidCursor = false;
  const seenCursors = new Set<string>();

  for (;;) {
    const response = await fetchMoonlightScholarLibraryPage({
      baseUrl: params.baseUrl,
      token: params.token,
      limit,
      cursor,
      signal: params.signal,
      fetchImpl: params.fetchImpl,
    });

    if (!response.ok) {
      const code = await readMoonlightLibraryErrorCode(response);
      if (
        response.status === 400 &&
        cursor &&
        !droppedInvalidCursor &&
        code === "MOONLIGHT_SCHOLAR_LIBRARY_CURSOR_INVALID"
      ) {
        papers = [];
        cursor = null;
        seenCursors.clear();
        droppedInvalidCursor = true;
        continue;
      }
      throw new MoonlightScholarLibraryApiError(
        `Moonlight Scholar library request failed with ${String(response.status)}.`,
        response.status,
        code,
      );
    }

    const parsed = moonlightLibraryResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("Moonlight Scholar library response is invalid.");
    }

    papers.push(...parsed.data.papers);
    const nextCursor = parsed.data.nextCursor;
    if (
      !nextCursor ||
      papers.length >= maxPapers ||
      parsed.data.papers.length === 0 ||
      seenCursors.has(nextCursor)
    ) {
      break;
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return papers.slice(0, maxPapers);
}

async function readMoonlightLibraryErrorCode(response: Response): Promise<string | null> {
  const body = (await response.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.code === "string") return record.code;
  const error = record.error;
  if (!error || typeof error !== "object") return null;
  const errorRecord = error as Record<string, unknown>;
  return typeof errorRecord.code === "string" ? errorRecord.code : null;
}

export function mapMoonlightLibraryPapersToContext(
  papers: readonly MoonlightLibraryPaper[],
  computedAt = new Date().toISOString(),
): LibraryContext | null {
  const foldersByName = new Map<
    string,
    { anchorCorpusIds: string[]; anchorPapers: LibraryAnchorPaper[]; seen: Set<string> }
  >();

  for (const paper of papers) {
    const corpusId = normalizeCorpusId(paper.identifiers.corpusId);
    if (!corpusId) continue;

    const title = paper.title?.trim() || "Untitled paper";
    const tagNames = paper.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
    const folderNames = tagNames.length > 0 ? tagNames : [DEFAULT_LIVE_LIBRARY_FOLDER_NAME];

    for (const folderName of folderNames) {
      const folder = foldersByName.get(folderName) ?? {
        anchorCorpusIds: [],
        anchorPapers: [],
        seen: new Set<string>(),
      };
      if (!folder.seen.has(corpusId)) {
        folder.seen.add(corpusId);
        folder.anchorCorpusIds.push(corpusId);
        folder.anchorPapers.push({ paperId: corpusId, title });
      }
      foldersByName.set(folderName, folder);
    }
  }

  const folders = [...foldersByName.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, folder]) => ({
      name,
      anchorCorpusIds: folder.anchorCorpusIds,
      anchorPapers: folder.anchorPapers,
    }));

  if (folders.length === 0) return null;

  return {
    folders,
    neighborhood: {},
    computedAt,
  };
}

function normalizeCorpusId(value: string | number | null | undefined): string | null {
  const raw = typeof value === "number" ? String(value) : value?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  return raw;
}

function normalizeReviewedPaperRef(value: string): string | null {
  const paperRef = value.trim();
  return paperRef && isEpisteme3PaperRef(paperRef) ? paperRef : null;
}

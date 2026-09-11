"use client";

import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { hasSameRouteAiCommentSemantics, type RouteAiComment } from "@/app/domain/route-ai-comment";
import { researchRoutePayloadSchema } from "@/app/domain/research-route-payload-schema";
import { gapReportReactionRoute } from "@/app/lib/api-routes";
import { fetchWithSilenceTimeout } from "@/app/lib/fetch-with-silence-timeout";
import {
  ApiResponseError,
  getApiErrorRetryDelayMs,
  readApiResponseError,
} from "@/app/lib/api-error-response";

interface GapReactionTransportWrite {
  documentId: string;
  reaction: RouteAiComment;
}

const GAP_REACTION_WRITE_TIMEOUT_MS = 15_000;
const GAP_REACTION_WRITE_MAX_ATTEMPTS = 4;
const GAP_REACTION_READ_BACK_INTERVAL_MS = 250;
const GAP_REACTION_READ_BACK_TIMEOUT_MS = 2_000;
const GAP_REACTION_READ_BACK_MAX_ATTEMPTS = 5;

export class DefiniteGapReactionWriteError extends Error {
  constructor(readonly apiError: ApiResponseError) {
    super(apiError.message, { cause: apiError });
  }
}

export class UnconfirmedGapReactionWriteError extends AggregateError {
  constructor(
    readonly latestDocument: ResearchRoutePayload | null,
    errors: unknown[],
  ) {
    super(errors, "gap reaction persistence outcome is still unconfirmed");
  }
}

function parseGapReactionDocument(raw: unknown, documentId: string): ResearchRoutePayload | null {
  const parsed = researchRoutePayloadSchema.safeParse(raw);
  return parsed.success && parsed.data.id === documentId ? parsed.data : null;
}

function hasConfirmedReaction(document: ResearchRoutePayload, requested: RouteAiComment): boolean {
  return [document.reaction, ...(document.reactionHistory ?? [])].some(
    (reaction) =>
      reaction?.timestamp === requested.timestamp &&
      hasSameRouteAiCommentSemantics(reaction, requested),
  );
}

async function requestGapReactionWrite(
  write: GapReactionTransportWrite,
  baseReactionVersion: number,
): Promise<ResearchRoutePayload> {
  const response = await fetchWithSilenceTimeout(
    gapReportReactionRoute(encodeURIComponent(write.documentId)),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction: write.reaction, baseReactionVersion }),
    },
    {
      deadlineMs: GAP_REACTION_WRITE_TIMEOUT_MS,
      discardBodyOnNonOk: false,
      timeoutMs: GAP_REACTION_WRITE_TIMEOUT_MS,
      timeoutMessage: "gap reaction persistence stalled",
      timeoutErrorName: "TimeoutError",
    },
  );
  if (!response.ok) {
    throw await readApiResponseError(response, "gap reaction persistence failed");
  }
  const raw: unknown = await response.json().catch((): unknown => null);
  const document = parseGapReactionDocument(raw, write.documentId);
  if (!document) throw new Error("invalid gap reaction persistence response");
  return document;
}

function waitForGapReactionDelay(
  delayMs: number = GAP_REACTION_READ_BACK_INTERVAL_MS,
): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

async function readBackGapReaction(
  write: GapReactionTransportWrite,
  errors: unknown[],
  shouldContinue: () => boolean,
  maxAttempts: number = GAP_REACTION_READ_BACK_MAX_ATTEMPTS,
): Promise<ResearchRoutePayload | null> {
  let latestDocument: ResearchRoutePayload | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!shouldContinue()) return latestDocument;
    try {
      const response = await fetchWithSilenceTimeout(
        gapReportReactionRoute(encodeURIComponent(write.documentId)),
        { method: "GET" },
        {
          deadlineMs: GAP_REACTION_READ_BACK_TIMEOUT_MS,
          discardBodyOnNonOk: true,
          timeoutMs: GAP_REACTION_READ_BACK_TIMEOUT_MS,
          timeoutMessage: "gap reaction read-back stalled",
          timeoutErrorName: "TimeoutError",
        },
      );
      if (!response.ok)
        throw new Error(`gap reaction read-back failed: ${String(response.status)}`);
      const raw: unknown = await response.json().catch((): unknown => null);
      const document = parseGapReactionDocument(raw, write.documentId);
      if (!document) throw new Error("invalid gap reaction read-back response");
      latestDocument = document;
      if (hasConfirmedReaction(document, write.reaction)) return document;
    } catch (error) {
      errors.push(error);
    }
    if (attempt < maxAttempts - 1) {
      await waitForGapReactionDelay();
    }
  }
  return latestDocument;
}

interface GapReactionAttemptState {
  nextBaseReactionVersion: number;
  consecutiveAmbiguousAttempts: number;
  latestDocument: ResearchRoutePayload | null;
  errors: unknown[];
}

type GapReactionAttemptOutcome =
  | { kind: "confirmed"; document: ResearchRoutePayload }
  | { kind: "continue" }
  | { kind: "read-back" };

function handleGapReactionWriteSuccess(
  document: ResearchRoutePayload,
  write: GapReactionTransportWrite,
  state: GapReactionAttemptState,
  shouldContinue: () => boolean,
): GapReactionAttemptOutcome {
  state.latestDocument = document;
  state.consecutiveAmbiguousAttempts = 0;
  if (hasConfirmedReaction(document, write.reaction)) {
    return { kind: "confirmed", document };
  }
  if (!shouldContinue()) {
    throw new UnconfirmedGapReactionWriteError(state.latestDocument, state.errors);
  }
  if (document.reactionVersion > state.nextBaseReactionVersion) {
    state.nextBaseReactionVersion = document.reactionVersion;
    return { kind: "continue" };
  }
  state.errors.push(new Error("gap reaction write returned without confirming the selection"));
  return { kind: "read-back" };
}

async function handleGapReactionConflict(
  write: GapReactionTransportWrite,
  state: GapReactionAttemptState,
  shouldContinue: () => boolean,
): Promise<GapReactionAttemptOutcome> {
  const observed = await readBackGapReaction(write, state.errors, shouldContinue, 1);
  if (!observed) {
    throw new UnconfirmedGapReactionWriteError(state.latestDocument, state.errors);
  }
  state.latestDocument = observed;
  if (hasConfirmedReaction(observed, write.reaction)) {
    return { kind: "confirmed", document: observed };
  }
  state.nextBaseReactionVersion = observed.reactionVersion;
  state.consecutiveAmbiguousAttempts = 0;
  return { kind: "continue" };
}

function handleAmbiguousGapReactionFailure(
  error: unknown,
  state: GapReactionAttemptState,
  shouldContinue: () => boolean,
  recordError: boolean,
): GapReactionAttemptOutcome {
  if (
    error instanceof DefiniteGapReactionWriteError ||
    error instanceof UnconfirmedGapReactionWriteError
  ) {
    throw error;
  }
  if (recordError) state.errors.push(error);
  state.consecutiveAmbiguousAttempts += 1;
  if (!shouldContinue()) {
    throw new UnconfirmedGapReactionWriteError(state.latestDocument, state.errors);
  }
  return state.consecutiveAmbiguousAttempts < 2 ? { kind: "continue" } : { kind: "read-back" };
}

async function handleGapReactionWriteFailure(
  error: unknown,
  write: GapReactionTransportWrite,
  state: GapReactionAttemptState,
  shouldContinue: () => boolean,
): Promise<GapReactionAttemptOutcome> {
  if (!(error instanceof ApiResponseError)) {
    return handleAmbiguousGapReactionFailure(error, state, shouldContinue, true);
  }
  state.errors.push(error);
  if (error.action === "refresh-and-rebase") {
    return handleGapReactionConflict(write, state, shouldContinue);
  }
  if (!error.retryable) {
    throw new DefiniteGapReactionWriteError(error);
  }
  if (error.action === "wait-and-retry") {
    await waitForGapReactionDelay(
      getApiErrorRetryDelayMs(error, GAP_REACTION_READ_BACK_INTERVAL_MS),
    );
    state.consecutiveAmbiguousAttempts = 0;
    return { kind: "continue" };
  }
  return handleAmbiguousGapReactionFailure(error, state, shouldContinue, false);
}

async function requireConfirmedGapReactionReadBack(
  write: GapReactionTransportWrite,
  state: GapReactionAttemptState,
  shouldContinue: () => boolean,
): Promise<ResearchRoutePayload> {
  const observed = await readBackGapReaction(write, state.errors, shouldContinue);
  state.consecutiveAmbiguousAttempts = 0;
  if (observed) {
    state.latestDocument = observed;
    if (hasConfirmedReaction(observed, write.reaction)) return observed;
  }
  throw new UnconfirmedGapReactionWriteError(state.latestDocument, state.errors);
}

export async function persistGapReactionWithTransportRetry(
  write: GapReactionTransportWrite,
  baseReactionVersion: number,
  shouldContinue: () => boolean = () => true,
): Promise<ResearchRoutePayload> {
  const state: GapReactionAttemptState = {
    nextBaseReactionVersion: baseReactionVersion,
    consecutiveAmbiguousAttempts: 0,
    latestDocument: null,
    errors: [],
  };

  for (let attempt = 0; attempt < GAP_REACTION_WRITE_MAX_ATTEMPTS; attempt += 1) {
    if (!shouldContinue()) {
      throw new UnconfirmedGapReactionWriteError(state.latestDocument, state.errors);
    }
    let outcome: GapReactionAttemptOutcome;
    try {
      const document = await requestGapReactionWrite(write, state.nextBaseReactionVersion);
      outcome = handleGapReactionWriteSuccess(document, write, state, shouldContinue);
    } catch (error) {
      outcome = await handleGapReactionWriteFailure(error, write, state, shouldContinue);
    }
    if (outcome.kind === "confirmed") return outcome.document;
    if (outcome.kind === "continue") continue;
    return requireConfirmedGapReactionReadBack(write, state, shouldContinue);
  }

  throw new UnconfirmedGapReactionWriteError(state.latestDocument, state.errors);
}

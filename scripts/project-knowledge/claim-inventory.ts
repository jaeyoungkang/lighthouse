import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import * as path from "node:path";
import {
  candidateClaimOwnerStatus,
  isRegularFileInsideLocalRoot,
  LOCAL_ROOT,
  localPath,
  readText,
  relativePath,
  sharedPath,
} from "./common";
import { lookupSharedReviewId } from "./shared-memory-entry.mjs";
import {
  isStructuredKnowledgeCandidate,
  validateKnowledgeObjectStore,
  validateStructuredKnowledgeCandidate,
} from "./knowledge-object";

const CLAIM_RE =
  /^candidate\.review-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.md$/;
const RESULT_HEADER_RE =
  /^<!-- project-knowledge-review-result:v1 id=([0-9a-f-]+) outcome=rejected bytes=(0|[1-9][0-9]*) sha256=([0-9a-f]{64}) -->\n/;

export type CandidateInventoryState =
  | "canonical"
  | "active"
  | "pending"
  | "canonical-conflict"
  | "already-shared"
  | "already-rejected"
  | "conflict"
  | "invalid";

export type CandidateInventoryItem = {
  path: string;
  basename: string;
  kind: "root" | "canonical" | "claim";
  reviewId?: string;
  state: CandidateInventoryState;
  reason: string;
};

function resultDigest(reviewId: string, payload: Buffer): string {
  return createHash("sha256")
    .update(Buffer.from(`v1\0${reviewId}\0rejected\0`, "utf8"))
    .update(payload)
    .digest("hex");
}

function pathEntryExists(filePath: string): boolean {
  try {
    lstatSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function rejectedResultStatus(reviewId: string): "absent" | "complete" | "conflict" {
  const resultPath = localPath(`rejected-candidate-${reviewId}.md`);
  if (!pathEntryExists(resultPath)) return "absent";
  if (!isRegularFileInsideLocalRoot(resultPath)) return "conflict";

  try {
    const content = readFileSync(resultPath, "utf8");
    return rejectedResultIsComplete(content, reviewId) ? "complete" : "conflict";
  } catch {
    return "conflict";
  }
}

function structuredResultStatus(
  reviewId: string,
  candidate: string,
  knowledgeObjects: string | undefined,
): "absent" | "complete" | "conflict" {
  if (!isStructuredKnowledgeCandidate(candidate)) return "absent";
  if (knowledgeObjects === undefined) return "conflict";
  try {
    const expected = new Set(
      validateStructuredKnowledgeCandidate(candidate, { verifyGrounding: false }).records.map(
        ({ object }) => object.id,
      ),
    );
    const store = validateKnowledgeObjectStore(knowledgeObjects, { verifyGrounding: false });
    if (!store.valid) return "conflict";
    const applied = new Set(
      store.records
        .filter(({ object }) => object.last_review_id === reviewId)
        .map(({ object }) => object.id),
    );
    if (applied.size === 0) return "absent";
    return applied.size === expected.size && [...expected].every((id) => applied.has(id))
      ? "complete"
      : "conflict";
  } catch {
    return "conflict";
  }
}

function claimState(
  reviewId: string,
  canonicalOccupied: boolean,
  sharedMemory: string | undefined,
  candidate: string | undefined,
  knowledgeObjects: string | undefined,
): Pick<CandidateInventoryItem, "state" | "reason"> {
  const ownerStatus = candidateClaimOwnerStatus(reviewId);
  if (ownerStatus === "live") {
    return { state: "active", reason: "live-review-owner" };
  }
  if (ownerStatus === "conflict") {
    return { state: "conflict", reason: "invalid-review-owner" };
  }
  if (candidate === undefined) {
    return { state: "conflict", reason: "candidate-unreadable" };
  }
  if (sharedMemory === undefined) {
    return { state: "conflict", reason: "shared-memory-unreadable" };
  }

  const structured = structuredResultStatus(reviewId, candidate, knowledgeObjects);

  const framed = lookupSharedReviewId(sharedMemory, reviewId, { validationScope: "target" });
  const sharedCount = framed.completeCount + framed.legacyCount;
  const rejected = rejectedResultStatus(reviewId);
  if (
    !framed.documentValid ||
    framed.malformedMention ||
    sharedCount > 1 ||
    rejected === "conflict" ||
    structured === "conflict"
  ) {
    return { state: "conflict", reason: "ambiguous-or-partial-result" };
  }
  const acceptedCount = sharedCount + (structured === "complete" ? 1 : 0);
  if (acceptedCount > 1 || (acceptedCount === 1 && rejected === "complete")) {
    return { state: "conflict", reason: "shared-and-rejected-results" };
  }
  if (acceptedCount === 1) return { state: "already-shared", reason: "complete-shared-result" };
  if (rejected === "complete") {
    return { state: "already-rejected", reason: "complete-rejected-result" };
  }
  if (canonicalOccupied) {
    return { state: "canonical-conflict", reason: "canonical-candidate-exists" };
  }
  return {
    state: "pending",
    reason: ownerStatus === "stale" ? "stale-review-owner" : "no-result",
  };
}

export function renderRejectedResult(reviewId: string, candidate: string, reason?: string): string {
  const body = reason
    ? `${candidate.trim()}\n\n## Review Reason\n\n${reason}\n`
    : `${candidate.trim()}\n`;
  const payload = Buffer.from(body, "utf8");
  const digest = resultDigest(reviewId, payload);
  return `<!-- project-knowledge-review-result:v1 id=${reviewId} outcome=rejected bytes=${String(payload.length)} sha256=${digest} -->\n${body}<!-- /project-knowledge-review-result:v1 id=${reviewId} -->\n`;
}

export function parseRejectedResult(content: string, expectedReviewId: string): boolean {
  const header = RESULT_HEADER_RE.exec(content);
  if (!header) return false;
  const [, reviewId, byteLengthText, declaredDigest] = header;
  if (reviewId !== expectedReviewId) return false;
  const byteLength = Number(byteLengthText);
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) return false;

  const source = Buffer.from(content, "utf8");
  const headerBytes = Buffer.byteLength(header[0], "utf8");
  const payloadEnd = headerBytes + byteLength;
  const trailer = Buffer.from(
    `<!-- /project-knowledge-review-result:v1 id=${reviewId} -->\n`,
    "utf8",
  );
  if (payloadEnd + trailer.length !== source.length) return false;
  const payload = source.subarray(headerBytes, payloadEnd);
  return (
    source.subarray(payloadEnd).equals(trailer) &&
    resultDigest(reviewId, payload) === declaredDigest
  );
}

export function rejectedResultIsComplete(content: string, reviewId: string): boolean {
  if (parseRejectedResult(content, reviewId)) return true;
  return content.endsWith(`\n\nProject Knowledge review id: ${reviewId}\n`);
}

export function listCandidateInventory(): CandidateInventoryItem[] {
  if (!existsSync(LOCAL_ROOT)) return [];
  let localRootStat;
  try {
    localRootStat = lstatSync(LOCAL_ROOT);
  } catch {
    return [];
  }
  if (!localRootStat.isDirectory() || localRootStat.isSymbolicLink()) {
    return [
      {
        path: LOCAL_ROOT,
        basename: path.basename(LOCAL_ROOT),
        kind: "root",
        state: "invalid",
        reason: "local-root-must-be-regular-directory",
      },
    ];
  }

  let sharedMemory: string | undefined;
  let knowledgeObjects: string | undefined;
  try {
    sharedMemory = readText(sharedPath("shared-memory.md"));
  } catch {
    sharedMemory = undefined;
  }
  try {
    knowledgeObjects = readText(sharedPath("knowledge-objects.md"));
  } catch {
    knowledgeObjects = undefined;
  }
  const names = readdirSync(LOCAL_ROOT)
    .filter((name) => name === "candidate.md" || name.startsWith("candidate.review-"))
    .sort();
  const canonicalPath = localPath("candidate.md");
  const canonicalOccupied = pathEntryExists(canonicalPath);

  return names.map((basename): CandidateInventoryItem => {
    const candidatePath = localPath(basename);
    if (basename === "candidate.md") {
      return isRegularFileInsideLocalRoot(candidatePath)
        ? {
            path: candidatePath,
            basename,
            kind: "canonical",
            state: "canonical",
            reason: "ready-for-review",
          }
        : {
            path: candidatePath,
            basename,
            kind: "canonical",
            state: "invalid",
            reason: "canonical-entry-must-be-regular-file",
          };
    }

    const match = CLAIM_RE.exec(basename);
    if (!match?.[1] || !isRegularFileInsideLocalRoot(candidatePath)) {
      return {
        path: candidatePath,
        basename,
        kind: "claim",
        reviewId: match?.[1],
        state: "invalid",
        reason: !match?.[1] ? "malformed-claim-name" : "claim-must-be-regular-file",
      };
    }
    return {
      path: candidatePath,
      basename,
      kind: "claim",
      reviewId: match[1],
      ...claimState(
        match[1],
        canonicalOccupied,
        sharedMemory,
        (() => {
          try {
            return readText(candidatePath);
          } catch {
            return undefined;
          }
        })(),
        knowledgeObjects,
      ),
    };
  });
}

export function formatCandidateInventoryItem(item: CandidateInventoryItem): string {
  return `- ${relativePath(item.path)} [${item.state}] reason=${item.reason}`;
}

export function findClaimInventoryItem(input: string): CandidateInventoryItem | undefined {
  const requested = path.resolve(path.isAbsolute(input) ? input : path.join(process.cwd(), input));
  return listCandidateInventory().find(
    (item) => item.kind === "claim" && path.resolve(item.path) === requested,
  );
}

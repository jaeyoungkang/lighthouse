import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import {
  findClaimInventoryItem,
  formatCandidateInventoryItem,
  listCandidateInventory,
  rejectedResultIsComplete,
  renderRejectedResult,
} from "./claim-inventory";
import {
  appendEvent,
  assertOpenLocalFileIdentity,
  claimCandidate,
  ensureLocalLayout,
  localPath,
  openLocalRegularFile,
  readOpenLocalText,
  reapStaleCandidateClaimOwner,
  relativePath,
  releaseCandidateClaimOwner,
  resolveCandidateClaim,
  restoreCandidateClaim,
  sharedPath,
  syncLocalRootDirectory,
  today,
  unlinkOpenLocalFile,
  writeLocalTextExclusive,
  writeTextAtomic,
} from "./common";
import { validateSharedCandidateMetadata } from "./candidate-metadata";
import {
  lookupSharedReviewId,
  renderSharedMemoryEntry,
  sharedMemoryAppendSeparator,
  validateSharedMemoryFrames,
} from "./shared-memory-entry.mjs";
import {
  isStructuredKnowledgeCandidate,
  mergeKnowledgeObjects,
  validateKnowledgeObjectStore,
  validateStructuredKnowledgeCandidate,
} from "./knowledge-object";

type SharedMutationLock = {
  path: string;
  opened: ReturnType<typeof openLocalRegularFile>;
};

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function reapDeadSharedMutationLock(lockPath: string): boolean {
  let opened: ReturnType<typeof openLocalRegularFile> | undefined;
  try {
    opened = openLocalRegularFile(lockPath);
    const owner = JSON.parse(readOpenLocalText(opened)) as { pid?: unknown };
    if (typeof owner.pid !== "number" || processIsAlive(owner.pid)) return false;
    unlinkOpenLocalFile(lockPath, opened);
    return true;
  } catch {
    return false;
  } finally {
    if (opened) closeSync(opened.fd);
  }
}

function acquireSharedMutationLock(): SharedMutationLock {
  ensureLocalLayout();
  const lockPath = localPath(".shared-memory-review.lock");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = randomUUID();
    const ownerPath = localPath(`.shared-memory-review.owner-${token}.lock`);
    const opened = writeLocalTextExclusive(
      ownerPath,
      `${JSON.stringify({ pid: process.pid, token, createdAt: new Date().toISOString() })}\n`,
    );
    try {
      linkSync(ownerPath, lockPath);
      assertOpenLocalFileIdentity(lockPath, opened);
      unlinkOpenLocalFile(ownerPath, opened);
      return { path: lockPath, opened };
    } catch (error) {
      try {
        unlinkOpenLocalFile(ownerPath, opened);
      } catch {
        // Preserve an unexpected owner artifact for Human inspection.
      }
      closeSync(opened.fd);
      if ((error as NodeJS.ErrnoException).code !== "EEXIST" || attempt > 0) throw error;
      if (!reapDeadSharedMutationLock(lockPath)) {
        throw new Error("Another Project Knowledge shared-memory review is active or unresolved.");
      }
    }
  }
  throw new Error("Could not acquire Project Knowledge shared-memory review lock.");
}

function releaseSharedMutationLock(lock: SharedMutationLock): void {
  try {
    assertOpenLocalFileIdentity(lock.path, lock.opened);
    unlinkOpenLocalFile(lock.path, lock.opened);
  } catch {
    // A missing or replaced lock is preserved for Human inspection.
  } finally {
    closeSync(lock.opened.fd);
  }
}

function appendSharedFrame(frame: string): void {
  const destination = sharedPath("shared-memory.md");
  const before = lstatSync(destination, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error("Project Knowledge shared memory must be a regular file.");
  }
  const fd = openSync(destination, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error("Project Knowledge shared-memory identity changed before append.");
    }
    writeFileSync(fd, frame, { encoding: "utf8" });
    fsyncSync(fd);
    const after = lstatSync(destination, { bigint: true });
    if (after.dev !== opened.dev || after.ino !== opened.ino) {
      throw new Error("Project Knowledge shared-memory identity changed during append.");
    }
  } finally {
    closeSync(fd);
  }
}

function assertSharedMemoryFramingValid(): string {
  const destination = sharedPath("shared-memory.md");
  const content = readFileSync(destination, "utf8");
  const validation = validateSharedMemoryFrames(content);
  if (!validation.valid) {
    throw new Error(
      `Project Knowledge shared memory has malformed or ambiguous frames: ${validation.reasons.join(", ")}`,
    );
  }
  return content;
}

function listCandidates(): void {
  ensureLocalLayout();
  const candidates = listCandidateInventory();
  if (candidates.length === 0) {
    console.log("No local Project Knowledge candidates.");
    return;
  }
  console.log("Local Project Knowledge candidates:");
  for (const candidate of candidates) console.log(formatCandidateInventoryItem(candidate));
}

function recoverClaim(claimInput: string): void {
  const inventory = findClaimInventoryItem(claimInput);
  if (!inventory?.reviewId || inventory.state !== "pending") {
    throw new Error(
      `Cannot recover Project Knowledge claim: ${inventory?.state ?? "invalid-or-missing"}`,
    );
  }
  const claim = resolveCandidateClaim(claimInput);
  reapStaleCandidateClaimOwner(claim.id);
  restoreCandidateClaim(claim);
  console.log(`검토 중단 후보 복원: ${relativePath(claim.canonicalPath)}`);
}

function confirmRejectedResultDurable(reviewId: string): void {
  const resultPath = localPath(`rejected-candidate-${reviewId}.md`);
  const opened = openLocalRegularFile(resultPath);
  try {
    if (!rejectedResultIsComplete(readOpenLocalText(opened), reviewId)) {
      throw new Error("Project Knowledge rejected result is incomplete or ambiguous.");
    }
    fsyncSync(opened.fd);
    assertOpenLocalFileIdentity(resultPath, opened);
  } finally {
    closeSync(opened.fd);
  }
}

function confirmSharedResultDurable(reviewId: string): void {
  const resultPath = sharedPath("shared-memory.md");
  const before = lstatSync(resultPath, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error("Project Knowledge shared result must be a regular file.");
  }
  const fd = openSync(resultPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error("Project Knowledge shared result identity changed before cleanup.");
    }
    const lookup = lookupSharedReviewId(readFileSync(fd, "utf8"), reviewId, {
      validationScope: "target",
    });
    if (
      !lookup.documentValid ||
      lookup.malformedMention ||
      lookup.completeCount + lookup.legacyCount !== 1
    ) {
      throw new Error("Project Knowledge shared result is incomplete or ambiguous.");
    }
    fsyncSync(fd);
    const after = lstatSync(resultPath, { bigint: true });
    if (after.dev !== opened.dev || after.ino !== opened.ino) {
      throw new Error("Project Knowledge shared result identity changed during cleanup.");
    }
  } finally {
    closeSync(fd);
  }
}

function confirmStructuredResultDurable(reviewId: string, candidate: string): void {
  const resultPath = sharedPath("knowledge-objects.md");
  const before = lstatSync(resultPath, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    throw new Error("Project Knowledge structured result must be a regular file.");
  }
  const fd = openSync(resultPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error("Project Knowledge structured result identity changed before cleanup.");
    }
    const expected = new Set(
      validateStructuredKnowledgeCandidate(candidate).records.map(({ object }) => object.id),
    );
    const validation = validateKnowledgeObjectStore(readFileSync(fd, "utf8"));
    const applied = new Set(
      validation.records
        .filter(({ object }) => object.last_review_id === reviewId)
        .map(({ object }) => object.id),
    );
    if (
      !validation.valid ||
      applied.size !== expected.size ||
      ![...expected].every((id) => applied.has(id))
    ) {
      throw new Error("Project Knowledge structured result is incomplete or ambiguous.");
    }
    fsyncSync(fd);
    const after = lstatSync(resultPath, { bigint: true });
    if (after.dev !== opened.dev || after.ino !== opened.ino) {
      throw new Error("Project Knowledge structured result identity changed during cleanup.");
    }
  } finally {
    closeSync(fd);
  }
  const directoryFd = openSync(sharedPath(), constants.O_RDONLY);
  try {
    fsyncSync(directoryFd);
  } finally {
    closeSync(directoryFd);
  }
}

function discardAppliedClaim(claimInput: string): void {
  const inventory = findClaimInventoryItem(claimInput);
  if (
    !inventory?.reviewId ||
    (inventory.state !== "already-shared" && inventory.state !== "already-rejected")
  ) {
    throw new Error(
      `Cannot discard Project Knowledge claim: ${inventory?.state ?? "invalid-or-missing"}`,
    );
  }
  const claim = resolveCandidateClaim(claimInput);
  reapStaleCandidateClaimOwner(claim.id);
  const openedClaim = openLocalRegularFile(claim.claimedPath);
  try {
    const refreshed = findClaimInventoryItem(claimInput);
    if (refreshed?.state !== inventory.state) {
      throw new Error(`Project Knowledge claim state changed: ${refreshed?.state ?? "missing"}`);
    }
    if (inventory.state === "already-rejected") confirmRejectedResultDurable(inventory.reviewId);
    else {
      const candidate = readOpenLocalText(openedClaim);
      if (isStructuredKnowledgeCandidate(candidate)) {
        confirmStructuredResultDurable(inventory.reviewId, candidate);
      } else confirmSharedResultDurable(inventory.reviewId);
    }
    unlinkOpenLocalFile(claim.claimedPath, openedClaim);
  } finally {
    closeSync(openedClaim.fd);
  }
  console.log(`적용 완료 claim 정리: ${relativePath(claim.claimedPath)} [${inventory.state}]`);
}

function appendSharedMemory(candidateInput: string): void {
  const claim = claimCandidate(candidateInput);
  let openedClaim: ReturnType<typeof openLocalRegularFile> | undefined;
  let mutationStarted = false;
  let sharedWritten = false;
  let metadata: ReturnType<typeof validateSharedCandidateMetadata> | undefined;
  let structuredMetadata:
    | ReturnType<typeof validateStructuredKnowledgeCandidate>["metadata"]
    | undefined;
  let destination = sharedPath("shared-memory.md");
  try {
    openedClaim = openLocalRegularFile(claim.claimedPath);
    const candidate = readFileSync(openedClaim.fd, "utf8").trim();
    const structured = isStructuredKnowledgeCandidate(candidate);
    const structuredCandidate = structured
      ? validateStructuredKnowledgeCandidate(candidate)
      : undefined;
    if (structuredCandidate) structuredMetadata = structuredCandidate.metadata;
    else metadata = validateSharedCandidateMetadata(candidate);
    const frame = structured
      ? undefined
      : renderSharedMemoryEntry({
          reviewId: claim.id,
          date: today(),
          sourcePath: relativePath(claim.canonicalPath),
          candidate,
        });
    const lock = acquireSharedMutationLock();
    try {
      if (structuredCandidate) {
        destination = sharedPath("knowledge-objects.md");
        const destinationStat = lstatSync(destination);
        if (!destinationStat.isFile() || destinationStat.isSymbolicLink()) {
          throw new Error("Project Knowledge object store must be a regular file.");
        }
        const current = readFileSync(destination, "utf8");
        const merged = mergeKnowledgeObjects(current, structuredCandidate.records, {}, claim.id);
        mutationStarted = true;
        writeTextAtomic(destination, merged);
        confirmStructuredResultDurable(claim.id, candidate);
      } else {
        const sharedBefore = assertSharedMemoryFramingValid();
        mutationStarted = true;
        appendSharedFrame(`${sharedMemoryAppendSeparator(sharedBefore)}${frame ?? ""}`);
      }
      sharedWritten = true;
    } finally {
      releaseSharedMutationLock(lock);
    }
    unlinkOpenLocalFile(claim.claimedPath, openedClaim);
  } catch (error) {
    if (!mutationStarted && !sharedWritten) restoreCandidateClaim(claim);
    throw error;
  } finally {
    if (openedClaim) closeSync(openedClaim.fd);
    releaseCandidateClaimOwner(claim);
  }

  appendEvent("memory.reviewed", {
    action: "approve-shared",
    candidate: relativePath(claim.canonicalPath),
    destination: relativePath(destination),
    reviewId: claim.id,
    ...(metadata
      ? { knowledgeLane: metadata.knowledgeLane, authorityRefs: metadata.authorityRefs }
      : {
          consolidation: structuredMetadata?.consolidation,
          extractionOutcome: structuredMetadata?.extractionOutcome,
        }),
  });
  console.log(
    `공유 기억 승격: ${relativePath(claim.canonicalPath)} -> ${relativePath(destination)}`,
  );
}

function moveLocal(candidateInput: string, action: "keep" | "reject", reason?: string): void {
  ensureLocalLayout();
  const claim = claimCandidate(candidateInput);
  let openedClaim: ReturnType<typeof openLocalRegularFile> | undefined;
  let openedDestination: ReturnType<typeof writeLocalTextExclusive> | undefined;
  try {
    if (action === "keep") {
      restoreCandidateClaim(claim);
      console.log(
        `로컬 후보 정리: ${relativePath(claim.canonicalPath)} -> ${relativePath(claim.canonicalPath)}`,
      );
      return;
    }

    const destinationPath = localPath(`rejected-candidate-${claim.id}.md`);
    openedClaim = openLocalRegularFile(claim.claimedPath);
    const content = readFileSync(openedClaim.fd, "utf8");
    assertOpenLocalFileIdentity(claim.claimedPath, openedClaim);
    openedDestination = writeLocalTextExclusive(
      destinationPath,
      renderRejectedResult(claim.id, content, reason),
    );
    syncLocalRootDirectory();
    assertOpenLocalFileIdentity(destinationPath, openedDestination);
    closeSync(openedDestination.fd);
    openedDestination = undefined;
    unlinkOpenLocalFile(claim.claimedPath, openedClaim);

    appendEvent("memory.reviewed", {
      action: "reject",
      candidate: relativePath(claim.canonicalPath),
      destination: relativePath(destinationPath),
      reviewId: claim.id,
      reason,
    });
    console.log(
      `로컬 후보 정리: ${relativePath(claim.canonicalPath)} -> ${relativePath(destinationPath)}`,
    );
  } finally {
    if (openedDestination) closeSync(openedDestination.fd);
    if (openedClaim) closeSync(openedClaim.fd);
    releaseCandidateClaimOwner(claim);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--list")) {
    listCandidates();
    return;
  }

  const recoverClaimInput = argValue(args, "--recover");
  if (recoverClaimInput) {
    recoverClaim(recoverClaimInput);
    return;
  }
  const discardClaimInput = argValue(args, "--discard-applied-claim");
  if (discardClaimInput) {
    discardAppliedClaim(discardClaimInput);
    return;
  }
  const approveCandidate = argValue(args, "--approve");
  if (approveCandidate) {
    appendSharedMemory(approveCandidate);
    return;
  }
  const localOnlyCandidate = argValue(args, "--local-only");
  if (localOnlyCandidate) {
    moveLocal(localOnlyCandidate, "keep");
    return;
  }
  const rejectedCandidate = argValue(args, "--reject");
  if (rejectedCandidate) {
    moveLocal(rejectedCandidate, "reject", argValue(args, "--reason"));
    return;
  }
  throw new Error(
    "Usage: pk:review -- [--list] [--approve <candidate>] [--local-only <candidate>] [--reject <candidate> --reason <text>] [--recover <claim>] [--discard-applied-claim <claim>]",
  );
}

main();

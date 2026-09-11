import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import * as path from "node:path";

export const REPO_ROOT = process.cwd();
export const SHARED_ROOT = path.join(REPO_ROOT, "docs", "project-knowledge");
export const LOCAL_ROOT = path.join(REPO_ROOT, ".project-knowledge-local");
export const LOCAL_ROOT_NAME = ".project-knowledge-local";
const CANDIDATE_CLAIM_RE =
  /^candidate\.review-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.md$/;

export function repoPath(...parts: string[]): string {
  return path.join(REPO_ROOT, ...parts);
}

export function sharedPath(...parts: string[]): string {
  return path.join(SHARED_ROOT, ...parts);
}

export function localPath(...parts: string[]): string {
  return path.join(LOCAL_ROOT, ...parts);
}

export function relativePath(filePath: string): string {
  return path.relative(REPO_ROOT, filePath);
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function ensureLocalLayout(): void {
  if (!existsSync(LOCAL_ROOT)) {
    mkdirSync(LOCAL_ROOT, { recursive: true });
  }
  const localRootStat = lstatSync(LOCAL_ROOT);
  if (!localRootStat.isDirectory() || localRootStat.isSymbolicLink()) {
    throw new Error(`Project Knowledge local root must be a regular directory: ${LOCAL_ROOT_NAME}`);
  }
}

export function workMemoryPath(): string {
  return localPath("work-memory.md");
}

export function workMemoryLogJsonPath(): string {
  return localPath("work-memory-log.jsonl");
}

export function archiveDir(): string {
  return localPath("archive");
}

export function archivedLogJsonPath(monthKey: string): string {
  return path.join(archiveDir(), `work-memory-log-${monthKey}.jsonl`);
}

export function monthKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function runGit(args: string[], fallback = ""): string {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallback;
  }
}

export function appendEvent(type: string, payload: Record<string, unknown>): void {
  ensureLocalLayout();
  void type;
  void payload;
}

export function collectMarkdownFiles(dir: string): string[] {
  return existsSync(dir) && dir.endsWith(".md") ? [dir] : [];
}

export function listSharedKnowledgeFiles(): string[] {
  return [
    sharedPath("README.md"),
    sharedPath("knowledge-objects.md"),
    sharedPath("shared-memory.md"),
  ].filter(existsSync);
}

export function listLocalKnowledgeFiles(): string[] {
  return [workMemoryPath(), workMemoryLogJsonPath()].filter(existsSync);
}

export function listArchivedLogJsonFiles(): string[] {
  const dir = archiveDir();
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.startsWith("work-memory-log-") && name.endsWith(".jsonl"))
    .map((name) => path.join(dir, name))
    .sort();
}

export function readText(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

export function writeText(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  writeFileSync(filePath, content);
}

export function writeTextAtomic(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  const temporaryPath = `${filePath}.write-${randomUUID()}`;
  try {
    writeFileSync(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    renameSync(temporaryPath, filePath);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
}

export function appendText(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  appendFileSync(filePath, content);
}

export function moveFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  renameSync(src, dest);
}

export function readLastJsonlRecord(filePath: string): Record<string, unknown> | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }
  const lines = readFileSync(filePath, "utf8").split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]?.trim();
    if (!line) continue;
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return undefined;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pathEntryExists(filePath: string): boolean {
  try {
    lstatSync(filePath);
    return true;
  } catch {
    return false;
  }
}

export type OpenLocalFile = {
  fd: number;
  dev: bigint;
  ino: bigint;
};

function assertRegularLocalRoot(): { dev: bigint; ino: bigint } {
  const stat = lstatSync(LOCAL_ROOT, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Project Knowledge local root must be a regular directory: ${LOCAL_ROOT_NAME}`);
  }
  return { dev: stat.dev, ino: stat.ino };
}

function assertDirectLocalChild(filePath: string): void {
  if (path.dirname(path.resolve(filePath)) !== path.resolve(LOCAL_ROOT)) {
    throw new Error(`Project Knowledge mutation target must be inside ${LOCAL_ROOT_NAME}`);
  }
}

function sameIdentity(
  left: { dev: bigint; ino: bigint },
  right: { dev: bigint; ino: bigint },
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

export function openLocalRegularFile(filePath: string): OpenLocalFile {
  assertDirectLocalChild(filePath);
  const rootIdentity = assertRegularLocalRoot();
  const fd = openSync(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(fd, { bigint: true });
    const pathname = lstatSync(filePath, { bigint: true });
    const currentRoot = lstatSync(LOCAL_ROOT, { bigint: true });
    if (
      !opened.isFile() ||
      !pathname.isFile() ||
      pathname.isSymbolicLink() ||
      !sameIdentity(opened, pathname) ||
      !sameIdentity(rootIdentity, currentRoot)
    ) {
      throw new Error(`Project Knowledge file identity changed: ${relativePath(filePath)}`);
    }
    return { fd, dev: opened.dev, ino: opened.ino };
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

export function assertOpenLocalFileIdentity(filePath: string, opened: OpenLocalFile): void {
  assertDirectLocalChild(filePath);
  assertRegularLocalRoot();
  const fdStat = fstatSync(opened.fd, { bigint: true });
  const pathStat = lstatSync(filePath, { bigint: true });
  if (
    !fdStat.isFile() ||
    !pathStat.isFile() ||
    pathStat.isSymbolicLink() ||
    !sameIdentity(opened, fdStat) ||
    !sameIdentity(opened, pathStat)
  ) {
    throw new Error(`Project Knowledge file identity changed: ${relativePath(filePath)}`);
  }
}

export function readOpenLocalText(opened: OpenLocalFile): string {
  const stat = fstatSync(opened.fd, { bigint: true });
  if (!stat.isFile() || !sameIdentity(opened, stat)) {
    throw new Error("Project Knowledge open file identity changed before read.");
  }
  const size = Number(stat.size);
  if (!Number.isSafeInteger(size)) throw new Error("Project Knowledge file is too large to read.");
  const content = Buffer.alloc(size);
  let offset = 0;
  while (offset < size) {
    const read = readSync(opened.fd, content, offset, size - offset, offset);
    if (read === 0) throw new Error("Project Knowledge file ended during held-descriptor read.");
    offset += read;
  }
  return content.toString("utf8");
}

export function writeLocalTextExclusive(filePath: string, content: string): OpenLocalFile {
  assertDirectLocalChild(filePath);
  const rootIdentity = assertRegularLocalRoot();
  const fd = openSync(
    filePath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile()) {
      throw new Error(
        `Project Knowledge destination must be a regular file: ${relativePath(filePath)}`,
      );
    }
    writeFileSync(fd, content, { encoding: "utf8" });
    fsyncSync(fd);
    const pathname = lstatSync(filePath, { bigint: true });
    const currentRoot = lstatSync(LOCAL_ROOT, { bigint: true });
    if (!sameIdentity(opened, pathname) || !sameIdentity(rootIdentity, currentRoot)) {
      throw new Error(`Project Knowledge destination identity changed: ${relativePath(filePath)}`);
    }
    return { fd, dev: opened.dev, ino: opened.ino };
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

export function syncLocalRootDirectory(): void {
  const rootIdentity = assertRegularLocalRoot();
  const fd = openSync(
    LOCAL_ROOT,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isDirectory() || !sameIdentity(rootIdentity, opened)) {
      throw new Error(`Project Knowledge local root identity changed: ${LOCAL_ROOT_NAME}`);
    }
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function unlinkOpenLocalFile(filePath: string, opened: OpenLocalFile): void {
  assertOpenLocalFileIdentity(filePath, opened);
  unlinkSync(filePath);
  syncLocalRootDirectory();
}

export function resolveCandidate(input: string): string {
  const candidate = path.resolve(localPath("candidate.md"));
  const requested = path.resolve(path.isAbsolute(input) ? input : repoPath(input));
  if (requested !== candidate) {
    throw new Error(
      `Project Knowledge review accepts only ${relativePath(candidate)}; received ${input}`,
    );
  }
  if (!pathEntryExists(candidate)) {
    throw new Error(`Candidate not found: ${input}`);
  }
  const localRootStat = lstatSync(LOCAL_ROOT);
  if (!localRootStat.isDirectory() || localRootStat.isSymbolicLink()) {
    throw new Error(`Project Knowledge local root must be a regular directory: ${LOCAL_ROOT_NAME}`);
  }
  const candidateStat = lstatSync(candidate);
  if (!candidateStat.isFile() || candidateStat.isSymbolicLink()) {
    throw new Error(
      `Project Knowledge candidate must be a regular file: ${relativePath(candidate)}`,
    );
  }
  const expectedRealCandidate = path.join(realpathSync(LOCAL_ROOT), "candidate.md");
  if (realpathSync(candidate) !== expectedRealCandidate) {
    throw new Error(
      `Project Knowledge candidate must stay inside ${LOCAL_ROOT_NAME}: ${relativePath(candidate)}`,
    );
  }
  return candidate;
}

export type CandidateClaim = {
  id: string;
  canonicalPath: string;
  claimedPath: string;
};

export type ActiveCandidateClaim = CandidateClaim & {
  ownerPath: string;
  owner: OpenLocalFile;
};

export type CandidateClaimOwnerStatus = "absent" | "live" | "stale" | "conflict";

function claimOwnerPath(reviewId: string): string {
  return localPath(`review-owner-${reviewId}.json`);
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function parseClaimOwner(content: string, reviewId: string): { pid: number; token: string } {
  const parsed = JSON.parse(content) as { reviewId?: unknown; pid?: unknown; token?: unknown };
  if (
    parsed.reviewId !== reviewId ||
    typeof parsed.pid !== "number" ||
    !Number.isSafeInteger(parsed.pid) ||
    parsed.pid <= 0 ||
    typeof parsed.token !== "string" ||
    parsed.token.length === 0
  ) {
    throw new Error("Invalid Project Knowledge claim owner identity.");
  }
  return { pid: parsed.pid, token: parsed.token };
}

export function candidateClaimOwnerStatus(reviewId: string): CandidateClaimOwnerStatus {
  const ownerPath = claimOwnerPath(reviewId);
  if (!pathEntryExists(ownerPath)) return "absent";
  let opened: OpenLocalFile | undefined;
  try {
    opened = openLocalRegularFile(ownerPath);
    const owner = parseClaimOwner(readOpenLocalText(opened), reviewId);
    return processIsAlive(owner.pid) ? "live" : "stale";
  } catch {
    return "conflict";
  } finally {
    if (opened) closeSync(opened.fd);
  }
}

export function reapStaleCandidateClaimOwner(reviewId: string): void {
  const ownerPath = claimOwnerPath(reviewId);
  if (!pathEntryExists(ownerPath)) return;
  const opened = openLocalRegularFile(ownerPath);
  try {
    const owner = parseClaimOwner(readOpenLocalText(opened), reviewId);
    if (processIsAlive(owner.pid)) {
      throw new Error("Project Knowledge claim is still owned by an active review.");
    }
    unlinkOpenLocalFile(ownerPath, opened);
  } finally {
    closeSync(opened.fd);
  }
}

export function claimCandidate(input: string): ActiveCandidateClaim {
  const canonicalPath = resolveCandidate(input);
  const id = randomUUID();
  const claimedPath = localPath(`candidate.review-${id}.md`);
  const token = randomUUID();
  const ownerPath = claimOwnerPath(id);
  const owner = writeLocalTextExclusive(
    ownerPath,
    `${JSON.stringify({ reviewId: id, pid: process.pid, token, createdAt: timestamp() })}\n`,
  );
  try {
    syncLocalRootDirectory();
    renameSync(canonicalPath, claimedPath);
    syncLocalRootDirectory();
    const claimedStat = lstatSync(claimedPath);
    const realLocalRoot = realpathSync(LOCAL_ROOT);
    const realClaimedPath = realpathSync(claimedPath);
    const relativeClaimedPath = path.relative(realLocalRoot, realClaimedPath);
    if (
      !claimedStat.isFile() ||
      claimedStat.isSymbolicLink() ||
      relativeClaimedPath.startsWith(`..${path.sep}`) ||
      relativeClaimedPath === ".." ||
      path.isAbsolute(relativeClaimedPath)
    ) {
      throw new Error("Claimed Project Knowledge candidate left its canonical local boundary.");
    }
    return { id, canonicalPath, claimedPath, ownerPath, owner };
  } catch (error) {
    try {
      if (!pathEntryExists(canonicalPath) && pathEntryExists(claimedPath)) {
        restoreCandidateClaim({ id, canonicalPath, claimedPath });
      }
    } finally {
      releaseCandidateClaimOwner({ id, canonicalPath, claimedPath, ownerPath, owner });
    }
    throw error;
  }
}

export function releaseCandidateClaimOwner(claim: ActiveCandidateClaim): void {
  try {
    if (pathEntryExists(claim.ownerPath)) unlinkOpenLocalFile(claim.ownerPath, claim.owner);
  } finally {
    closeSync(claim.owner.fd);
  }
}

export function isRegularFileInsideLocalRoot(filePath: string): boolean {
  try {
    const localRootStat = lstatSync(LOCAL_ROOT);
    if (!localRootStat.isDirectory() || localRootStat.isSymbolicLink()) return false;
    const fileStat = lstatSync(filePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) return false;
    const relativeRealPath = path.relative(realpathSync(LOCAL_ROOT), realpathSync(filePath));
    return (
      relativeRealPath !== ".." &&
      !relativeRealPath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeRealPath)
    );
  } catch {
    return false;
  }
}

export function resolveCandidateClaim(input: string): CandidateClaim {
  const requested = path.resolve(path.isAbsolute(input) ? input : repoPath(input));
  const name = path.basename(requested);
  const match = CANDIDATE_CLAIM_RE.exec(name);
  const expected = localPath(name);
  if (!match?.[1] || requested !== expected || !isRegularFileInsideLocalRoot(requested)) {
    throw new Error(`Invalid Project Knowledge review claim: ${input}`);
  }
  return {
    id: match[1],
    canonicalPath: localPath("candidate.md"),
    claimedPath: requested,
  };
}

export function restoreCandidateClaim(claim: CandidateClaim): void {
  if (!pathEntryExists(claim.claimedPath)) return;
  const openedClaim = openLocalRegularFile(claim.claimedPath);
  let openedCanonical: OpenLocalFile | undefined;
  try {
    const content = readOpenLocalText(openedClaim);
    assertOpenLocalFileIdentity(claim.claimedPath, openedClaim);
    openedCanonical = writeLocalTextExclusive(claim.canonicalPath, content);
    syncLocalRootDirectory();
    assertOpenLocalFileIdentity(claim.canonicalPath, openedCanonical);
    closeSync(openedCanonical.fd);
    openedCanonical = undefined;
    unlinkOpenLocalFile(claim.claimedPath, openedClaim);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `A newer Project Knowledge candidate exists; preserved the reviewed artifact at ${relativePath(claim.claimedPath)}`,
      );
    }
    throw error;
  } finally {
    if (openedCanonical) closeSync(openedCanonical.fd);
    closeSync(openedClaim.fd);
  }
}

import { lstat, realpath } from "node:fs/promises";
import path from "node:path";

const retiredAuthoritySegments = new Set([
  "archive",
  "archives",
  "review",
  "reviews",
  "review-archive",
  "reviews-archive",
  "history",
  "historical",
  "generated",
  "__generated__",
  "glossary",
]);

export async function assertRegistryFile(
  filePath: string,
  repositoryRoot = process.cwd(),
): Promise<void> {
  const relative = await assertExactRegularFile(filePath, repositoryRoot);
  if (relative !== "docs/glossary/terms.json") {
    throw new Error(`unexpected glossary registry owner: ${relative}`);
  }
}

export async function assertCurrentAuthorityFile(
  filePath: string,
  repositoryRoot = process.cwd(),
): Promise<void> {
  const relative = await assertExactRegularFile(filePath, repositoryRoot);
  if (
    !relative.startsWith("docs/") ||
    hasNonCurrentSourceSegment(relative) ||
    /\.generated\.md$/.test(relative.toLowerCase())
  ) {
    throw new Error(`glossary authority must be a current source: ${relative}`);
  }
}

export function hasNonCurrentSourceSegment(relativePath: string): boolean {
  return relativePath
    .toLowerCase()
    .split("/")
    .some((segment) => retiredAuthoritySegments.has(segment));
}

export async function assertProjectionFile(
  filePath: string,
  repositoryRoot = process.cwd(),
): Promise<void> {
  await assertExactRegularFile(filePath, repositoryRoot);
}

export async function preflightProjectionTarget(
  filePath: string,
  repositoryRoot = process.cwd(),
): Promise<void> {
  try {
    await assertExactRegularFile(filePath, repositoryRoot);
  } catch (error: unknown) {
    if (!isMissingFileError(error)) throw error;
    await assertExactDirectory(path.dirname(filePath), repositoryRoot);
  }
}

export async function assertExactRegularFile(
  filePath: string,
  repositoryRoot = process.cwd(),
): Promise<string> {
  const fileStat = await lstat(filePath);
  if (!fileStat.isFile()) {
    throw new Error(`glossary owner must be a regular file: ${filePath}`);
  }
  return assertExactPhysicalPath(filePath, repositoryRoot);
}

async function assertExactDirectory(directoryPath: string, repositoryRoot: string): Promise<void> {
  const directoryStat = await lstat(directoryPath);
  if (!directoryStat.isDirectory()) {
    throw new Error(`glossary output parent must be a directory: ${directoryPath}`);
  }
  await assertExactPhysicalPath(directoryPath, repositoryRoot);
}

async function assertExactPhysicalPath(
  targetPath: string,
  repositoryRoot: string,
): Promise<string> {
  const [physicalRoot, physicalTarget] = await Promise.all([
    realpath(repositoryRoot),
    realpath(targetPath),
  ]);
  const relativePhysical = toPosix(path.relative(physicalRoot, physicalTarget));
  const relativeAuthored = toPosix(
    path.relative(path.resolve(repositoryRoot), path.resolve(targetPath)),
  );

  if (
    relativePhysical === "" ||
    relativePhysical.startsWith("../") ||
    path.isAbsolute(relativePhysical)
  ) {
    throw new Error(`glossary owner escapes the repository: ${targetPath}`);
  }
  if (relativePhysical !== relativeAuthored) {
    throw new Error(`glossary owner must use exact physical spelling: ${targetPath}`);
  }
  return relativePhysical;
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function toPosix(filePath: string): string {
  return filePath.replaceAll(path.sep, "/");
}

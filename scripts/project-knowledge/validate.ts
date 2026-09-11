import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { LOCAL_ROOT_NAME, REPO_ROOT, SHARED_ROOT } from "./common";
import { validateSharedMemoryFrames } from "./shared-memory-entry.mjs";
import { validateKnowledgeObjectStore } from "./knowledge-object";

const REQUIRED_SHARED_PATHS = ["README.md", "knowledge-objects.md", "shared-memory.md"];

type Finding = {
  path: string;
  message: string;
};

function readGitTrackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return output.split("\n").filter(Boolean);
}

function validateRequiredPaths(findings: Finding[]): void {
  for (const relativePath of REQUIRED_SHARED_PATHS) {
    const fullPath = path.join(SHARED_ROOT, relativePath);
    if (!existsSync(fullPath)) {
      findings.push({
        path: path.relative(REPO_ROOT, fullPath),
        message: "required Project Knowledge path is missing",
      });
    }
  }
}

function validateLocalBoundary(findings: Finding[]): void {
  const trackedFiles = readGitTrackedFiles();
  for (const trackedFile of trackedFiles) {
    if (trackedFile === LOCAL_ROOT_NAME || trackedFile.startsWith(`${LOCAL_ROOT_NAME}/`)) {
      findings.push({
        path: trackedFile,
        message: "local Project Knowledge files must not be tracked by git",
      });
    }
  }

  const gitignore = readFileSync(path.join(REPO_ROOT, ".gitignore"), "utf8");
  if (!gitignore.includes(`${LOCAL_ROOT_NAME}/`)) {
    findings.push({
      path: ".gitignore",
      message: `${LOCAL_ROOT_NAME}/ must be gitignored`,
    });
  }
}

function validateSharedMemoryFraming(findings: Finding[]): void {
  const sharedMemoryPath = path.join(SHARED_ROOT, "shared-memory.md");
  if (!existsSync(sharedMemoryPath)) return;
  const result = validateSharedMemoryFrames(readFileSync(sharedMemoryPath, "utf8"));
  for (const reason of result.reasons) {
    findings.push({
      path: path.relative(REPO_ROOT, sharedMemoryPath),
      message: `invalid framed shared-memory entry: ${String(reason)}`,
    });
  }
}

function validateStructuredKnowledge(findings: Finding[]): void {
  const knowledgePath = path.join(SHARED_ROOT, "knowledge-objects.md");
  if (!existsSync(knowledgePath)) return;
  const validation = validateKnowledgeObjectStore(readFileSync(knowledgePath, "utf8"));
  for (const reason of validation.reasons) {
    findings.push({
      path: path.relative(REPO_ROOT, knowledgePath),
      message: `invalid structured knowledge object: ${reason}`,
    });
  }

  const legacyPath = path.join(SHARED_ROOT, "shared-memory.md");
  if (!existsSync(legacyPath)) return;
  const legacy = readFileSync(legacyPath, "utf8");
  for (const { object } of validation.records) {
    for (const legacyRef of object.legacy_refs) {
      if (legacyRef.startsWith("review:")) {
        const reviewId = legacyRef.slice("review:".length);
        if (!legacy.includes(`project-knowledge-entry:v1 id=${reviewId} `)) {
          findings.push({
            path: path.relative(REPO_ROOT, knowledgePath),
            message: `unknown legacy review ref: ${object.id}:${legacyRef}`,
          });
        }
      } else if (legacyRef.startsWith("title:")) {
        const title = legacyRef.slice("title:".length);
        if (!legacy.includes(`# Narrative: ${title}`)) {
          findings.push({
            path: path.relative(REPO_ROOT, knowledgePath),
            message: `unknown legacy title ref: ${object.id}:${legacyRef}`,
          });
        }
      }
    }
  }
}

function main(): void {
  const findings: Finding[] = [];

  validateRequiredPaths(findings);
  validateLocalBoundary(findings);
  validateSharedMemoryFraming(findings);
  validateStructuredKnowledge(findings);

  if (findings.length > 0) {
    console.error("Project Knowledge validation failed:");
    for (const finding of findings) {
      console.error(`- ${finding.path}: ${finding.message}`);
    }
    process.exit(1);
  }

  console.log("Project Knowledge validation passed.");
}

main();

import { existsSync } from "node:fs";
import { formatCandidateInventoryItem, listCandidateInventory } from "./claim-inventory";
import {
  appendEvent,
  ensureLocalLayout,
  listLocalKnowledgeFiles,
  listSharedKnowledgeFiles,
  localPath,
  readText,
  relativePath,
  runGit,
  sharedPath,
  today,
  workMemoryLogJsonPath,
  workMemoryPath,
  writeText,
} from "./common";
import { formatPilotObservationReminder, parsePilotObservationStatus } from "./pilot-observation";

function ensureLocalIdentity(): boolean {
  const identityPath = localPath("local-identity.md");
  if (existsSync(identityPath)) {
    return false;
  }

  writeText(
    identityPath,
    `# 로컬 Project Knowledge Identity

생성일: ${today()}

이 파일은 현재 clone에서 쓰는 로컬 정체성 메모다.

## 역할

- [ ] maintainer
- [ ] contributor
- [ ] reviewer
- [ ] explorer

## 기본 목표

- [ ] feature work
- [ ] bug fix
- [ ] research
- [ ] review
- [ ] learning

## 공유 선호

- [x] local only
- [ ] share candidates only
- [ ] team shared by approval

## 메모

`,
  );

  return true;
}

function printOnboarding(createdIdentity: boolean): void {
  console.log("");
  console.log("온보딩 체크");
  console.log("- docs/project-knowledge/README.md의 `처음 사용할 때` 절을 확인했다.");
  console.log(
    "- 최신 작업 기억은 .project-knowledge-local/work-memory.md, append-only 로그는 .project-knowledge-local/work-memory-log.jsonl에 남긴다. 사람이 읽고 싶으면 `npm run pk:log -- --tail 5`.",
  );
  console.log("- 작업 전환, 커밋 전후, 컨텍스트 정리 시점에 한국어 narrative로 기억을 갱신한다.");
  console.log(
    "- repo 차원의 반복 설명은 candidate.md에서 0..n개 객체로 추출하고 review 후 knowledge-objects.md에 반영한다.",
  );
  console.log(
    "- shared-memory.md는 legacy read source다. 새 공유 write는 structured candidate만 받는다.",
  );

  if (createdIdentity) {
    console.log("");
    console.log("로컬 identity가 새로 만들어졌다. 필요하면 다음 파일을 개인 용도에 맞게 채운다:");
    console.log(`  ${relativePath(localPath("local-identity.md"))}`);
  }
}

function printRecentWorkMemoryLog(): void {
  const logPath = workMemoryLogJsonPath();
  if (!existsSync(logPath)) {
    return;
  }

  const records = readText(logPath)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3);
  if (records.length === 0) {
    return;
  }
  console.log("Recent local work memory (last 3):");
  for (const line of records) {
    try {
      const parsed = JSON.parse(line) as {
        summary?: string;
        source_refs?: { recordedAt?: string; branch?: string };
      };
      const at = parsed.source_refs?.recordedAt ?? "";
      const branch = parsed.source_refs?.branch ?? "";
      console.log(`- ${at} (${branch}): ${parsed.summary ?? ""}`);
    } catch {
      // skip malformed line
    }
  }
  console.log("");
  console.log("더 보려면: npm run pk:log -- --tail 10 (--all 로 archive 포함)");
  console.log("");
}

function printPilotObservationReminder(): void {
  const evaluationPath = sharedPath("pilot-evaluation.md");
  if (!existsSync(evaluationPath)) {
    return;
  }
  const status = parsePilotObservationStatus(readText(evaluationPath));
  if (!status) {
    return;
  }

  console.log("");
  console.log(formatPilotObservationReminder(status));
}

function main(): void {
  ensureLocalLayout();
  const createdIdentity = ensureLocalIdentity();
  const branch = runGit(["branch", "--show-current"], "unknown");
  const head = runGit(["rev-parse", "--short", "HEAD"], "unknown");
  const sharedFiles = listSharedKnowledgeFiles().map(relativePath);
  const localKnowledgeFiles = listLocalKnowledgeFiles().map(relativePath);
  const candidates = listCandidateInventory();
  const localWorkMemoryPath = workMemoryPath();

  appendEvent("session.started", {
    branch,
    head,
    createdLocalIdentity: createdIdentity,
    sharedKnowledgeCount: sharedFiles.length,
    localKnowledgeCount: localKnowledgeFiles.length,
    candidateCount: candidates.length,
  });

  console.log("Project Knowledge start");
  console.log(`- branch: ${branch}`);
  console.log(`- head: ${head}`);
  console.log(
    `- local identity: ${createdIdentity ? "created" : "loaded"} (${relativePath(localPath("local-identity.md"))})`,
  );
  console.log(`- guide: ${relativePath(sharedPath("README.md"))}`);
  console.log(`- shared files: ${String(sharedFiles.length)}`);
  console.log(`- local memory files: ${String(localKnowledgeFiles.length)}`);
  console.log(`- local candidates: ${String(candidates.length)}`);

  if (candidates.length > 0) {
    console.log("");
    console.log("Local candidates:");
    for (const candidate of candidates) console.log(formatCandidateInventoryItem(candidate));
  }

  if (sharedFiles.length > 0) {
    console.log("");
    console.log("Shared knowledge:");
    for (const file of sharedFiles) {
      console.log(`- ${file}`);
    }
  }

  if (localKnowledgeFiles.length > 0) {
    console.log("");
    console.log("Local memory files:");
    for (const file of localKnowledgeFiles.slice(0, 12)) {
      console.log(`- ${file}`);
    }
    if (localKnowledgeFiles.length > 12) {
      console.log(`- ... ${String(localKnowledgeFiles.length - 12)} more`);
    }
  }

  console.log("");
  if (existsSync(localWorkMemoryPath)) {
    console.log("Local work memory:");
    console.log(readText(localWorkMemoryPath).split("\n").slice(0, 80).join("\n"));
    console.log("");
  }

  printRecentWorkMemoryLog();

  printPilotObservationReminder();

  console.log(readText(sharedPath("README.md")).split("\n").slice(0, 18).join("\n"));

  printOnboarding(createdIdentity);
}

main();

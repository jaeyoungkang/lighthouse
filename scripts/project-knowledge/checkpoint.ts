import {
  ensureLocalLayout,
  localPath,
  readText,
  relativePath,
  runGit,
  today,
  workMemoryLogJsonPath,
  writeTextAtomic,
} from "./common";
import { existsSync } from "node:fs";

function parseChangedFiles(statusOutput: string): string[] {
  return statusOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^.. /, ""))
    .filter((file) => !file.startsWith(".project-knowledge-local/"));
}

function main(): void {
  ensureLocalLayout();

  const branch = runGit(["branch", "--show-current"], "unknown");
  const head = runGit(["rev-parse", "HEAD"], "unknown");
  const status = runGit(["status", "--short"], "");
  const changedFiles = parseChangedFiles(status);
  const recentMemoryLog = (() => {
    const logPath = workMemoryLogJsonPath();
    if (!existsSync(logPath)) return "";
    const lines = readText(logPath)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-3);
    return lines
      .map((line) => {
        try {
          const parsed = JSON.parse(line) as {
            summary?: string;
            source_refs?: { recordedAt?: string; branch?: string };
          };
          const at = parsed.source_refs?.recordedAt ?? "";
          const branch = parsed.source_refs?.branch ?? "";
          return `- ${at} (${branch}): ${parsed.summary ?? ""}`;
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .join("\n");
  })();

  if (changedFiles.length === 0) {
    console.log("변경 파일이 없어 consolidation 후보를 갱신하지 않았다.");
    return;
  }

  const candidatePath = localPath("candidate.md");
  const fileRefs = changedFiles.map((file) => `  - file: ${file}`).join("\n");
  const body = `---
status: candidate
confidence: low
last_reviewed: ${today()}
consolidation: structured
extraction_outcome: pending
review_summary: pending
review_checks:
  command_free: pending
  one_pr_falsification: pending
  verdict_free: pending
  second_situation: pending
  single_subject: pending
  deletion: pending
source_refs:
  - commit: ${head}
${fileRefs}
supersedes:
  -
---

# Consolidation Candidate: [주제]

## 현재 형태

현재 구조나 판단을 한국어 문장으로 설명한다.

## 형성 과정

이 형태가 된 작업 흐름과 판단 전환을 설명한다.

## 추출 결과

- 공유하지 않으면 0개로 두고 \`--local-only\`를 사용한다.
- 현재 projection에서 같은 subject와 answers를 먼저 찾는다.
- 기존 객체 enrich/revise/split, relation·temporal transition, 새 객체 생성 중
  가장 작은 조직화 결과를 선택한다.

## 조직화 검토

- 기존 객체로 흡수할 수 없는 새 subject인지 설명한다.
- case를 지지·반박·형성한 concept/model의 relation target으로 연결한다.
- 같은 질문을 답하는 중복 객체와 relation 없는 orphan case가 없는지 확인한다.
- projection의 recall path가 어떻게 더 명확해지는지 설명한다.

<!-- project-knowledge-object:v1 -->
\`\`\`yaml
id: product.example-id
lifecycle: shared-consolidated
plane: product
kind: concept
title: 예시를 실제 제목으로 바꾼다
aliases:
  - 실제 회상 별칭
statement: 실제 설명을 쓴다.
scope:
  - 적용 범위
non_scope:
  - 적용하지 않는 범위
forces:
  - 이 설명을 만든 긴장
rejected_alternatives:
  - alternative: 기각한 대안
    reason: 기각한 이유
authority_refs:
  - docs/product-identity.md
grounding:
  - type: commit
    ref: ${head}
    path: docs/product-identity.md
    note: 이 객체를 뒷받침하는 정확한 근거
relations: []
temporal_status: current
evolution:
  - date: ${today()}
    note: 객체가 형성되거나 바뀐 이유
refresh_conditions:
  - 설명을 다시 검토할 조건
answers:
  - 다음 작업에서 답할 구체적인 질문
legacy_refs: []
\`\`\`

## 다음 처리

- 다음 agent가 이어서 수행할 처리 순서를 적는다.

## 주의 지점

- 다음 agent가 같은 문제를 다룰 때 주의해야 할 점을 적는다.

## 근거

- branch: \`${branch}\`
- head: \`${head}\`
${changedFiles.map((file) => `- file: \`${file}\``).join("\n")}

### 최근 로컬 작업 기억 로그

${recentMemoryLog || "- 없음"}

## Review

- [ ] extract 0..n concept/model/case objects instead of copying the narrative
- [ ] assign exactly one plane and kind per object
- [ ] name current authority refs and exact grounding commits
- [ ] prefer enrich/revise/split and relation changes before creating a new object
- [ ] reject duplicate subjects and unexplained orphan cases
- [ ] pass all six shadow-canon review checks in frontmatter
- [ ] local-only
- [ ] approve to structured shared knowledge
`;

  writeTextAtomic(candidatePath, body);

  console.log(`consolidation 후보 갱신: ${relativePath(candidatePath)}`);
  console.log(`승격: npm run pk:review -- --approve ${relativePath(candidatePath)}`);
}

main();

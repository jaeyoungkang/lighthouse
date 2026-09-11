import {
  appendText,
  archivedLogJsonPath,
  ensureLocalLayout,
  monthKey,
  moveFile,
  readLastJsonlRecord,
  relativePath,
  runGit,
  timestamp,
  timestampSlug,
  today,
  workMemoryLogJsonPath,
  workMemoryPath,
  writeText,
} from "./common";
import { listCandidateInventory } from "./claim-inventory";

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1 || index + 1 >= args.length) {
    return undefined;
  }
  return args[index + 1];
}

function csvValues(input?: string): string[] {
  return [
    ...new Set(
      input
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 8) ?? [],
    ),
  ];
}

const ENCODING_DEPTH_VALUES = ["decision", "discovery", "discussion", "mention"] as const;
const ROLE_VALUES = ["goal", "decision", "constraint", "result", "issue"] as const;

function validateEncodingDepth(value: string | undefined): string {
  if (value === undefined) {
    return "mention";
  }
  if (!(ENCODING_DEPTH_VALUES as readonly string[]).includes(value)) {
    throw new Error(
      `--encoding-depth는 ${ENCODING_DEPTH_VALUES.join(" | ")} 중 하나여야 한다. 받은 값: "${value}" (docs/project-knowledge/README.md § 회상 키 기준 참고)`,
    );
  }
  return value;
}

function validateRole(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  if (!(ROLE_VALUES as readonly string[]).includes(value)) {
    throw new Error(
      `--role은 ${ROLE_VALUES.join(" | ")} 중 하나여야 한다. 받은 값: "${value}" (docs/project-knowledge/README.md § 회상 키 기준 참고)`,
    );
  }
  return value;
}

function rotateIfMonthChanged(currentMonth: string): string | undefined {
  const livePath = workMemoryLogJsonPath();
  const last = readLastJsonlRecord(livePath);
  const sourceRefs = last?.source_refs as { recordedAt?: unknown } | undefined;
  const lastRecordedAt = sourceRefs?.recordedAt;
  if (typeof lastRecordedAt !== "string") {
    return undefined;
  }
  const lastMonth = lastRecordedAt.slice(0, 7);
  if (lastMonth === currentMonth) {
    return undefined;
  }
  const dest = archivedLogJsonPath(lastMonth);
  moveFile(livePath, dest);
  return dest;
}

function main(): void {
  ensureLocalLayout();

  const args = process.argv.slice(2);
  const note = argValue(args, "--note");
  if (!note) {
    throw new Error('pk:remember requires --note "<한국어 narrative>"');
  }
  const domainTags = csvValues(argValue(args, "--domain-tags"));
  const entities = csvValues(argValue(args, "--entities"));
  const goalLinks = csvValues(argValue(args, "--goal-links"));
  const contextHint = argValue(args, "--context-hint");
  const role = validateRole(argValue(args, "--role"));
  const encodingDepth = validateEncodingDepth(argValue(args, "--encoding-depth"));

  if (domainTags.length === 0 && entities.length === 0) {
    console.error(
      "회상 키가 비어 있다: --domain-tags 또는 --entities를 지정해라 (docs/project-knowledge/README.md § 회상 키 기준).",
    );
  }

  const candidates = listCandidateInventory().map((candidate) => relativePath(candidate.path));
  const branch = runGit(["branch", "--show-current"], "unknown");
  const head = runGit(["rev-parse", "--short", "HEAD"], "unknown");
  const recordedAt = timestamp();
  const session =
    process.env.PROJECT_KNOWLEDGE_SESSION_ID ??
    process.env.CODEX_SESSION_ID ??
    process.env.CLAUDE_SESSION_ID ??
    `remember-${timestampSlug()}`;

  const rotatedTo = rotateIfMonthChanged(monthKey());

  appendText(
    workMemoryLogJsonPath(),
    `${JSON.stringify({
      schema: "lighthouse.project-knowledge.work-memory.v1",
      id: `pk-${recordedAt}`,
      type: "session",
      date: today(),
      title: "Light House 로컬 작업 기억",
      summary: note,
      context_hint: contextHint,
      encoding_depth: encodingDepth,
      role,
      domain_tags: domainTags,
      entities,
      goal_links: goalLinks,
      events: [
        {
          kind: "work_memory",
          content: note,
          context_hint: contextHint,
          encoding_depth: encodingDepth,
          role,
          domain_tags: domainTags,
          entities,
          goal_links: goalLinks,
        },
      ],
      source_refs: {
        branch,
        head,
        session,
        pid: process.pid,
        recordedAt,
      },
    })}\n`,
  );

  const body = `# 로컬 작업 기억

마지막 갱신: ${today()}

이 파일은 현재 clone에서 쓰는 로컬 작업 기억이다. 컨텍스트가 지워진 뒤 다음
agent가 작업을 이어받기 위해 먼저 읽는다.

## 현재 기억

${note}

## 회상 키

- context_hint: ${contextHint ?? "명시 없음"}
- encoding_depth: ${encodingDepth}
- role: ${role ?? "명시 없음"}
- domain_tags: ${domainTags.length > 0 ? domainTags.join(", ") : "명시 없음"}
- entities: ${entities.length > 0 ? entities.join(", ") : "명시 없음"}
- goal_links: ${goalLinks.length > 0 ? goalLinks.join(", ") : "명시 없음"}

## 이어받을 때

- 먼저 이 파일의 현재 기억을 읽는다.
- 과거 작업 기억이 필요하면 \`npm run pk:recall -- <query>\`로
  \`.project-knowledge-local/work-memory-log.jsonl\`과 archive를 검색한다.
  archive까지 보려면 \`--all\`을 붙인다. 최근 N개를 사람이 읽고 싶으면
  \`npm run pk:log -- --tail <N>\`을 쓴다.
- 회상 키는 자동으로 넓게 추출하지 않는다. 필요할 때만 \`--domain-tags\`,
  \`--entities\`, \`--goal-links\`, \`--context-hint\`, \`--role\`,
  \`--encoding-depth\`를 명시한다.
- 필요한 경우 pk:remember 명령에 한국어 narrative를 note로 전달해 갱신한다.
- repo 차원에서 반복해서 필요한 기억만 공유 후보로 만든다.
- 기억 본문은 한국어 narrative로 쓴다. 진행 흐름, 판단, 다음 처리 순서를
  문장으로 남긴다.

## 공유 후보

${candidates.length > 0 ? candidates.map((candidate) => `- \`${candidate}\``).join("\n") : "- 없음"}
`;

  writeText(workMemoryPath(), body);
  console.log(`로컬 작업 기억 갱신: ${relativePath(workMemoryPath())}`);
  console.log(`로컬 작업 기억 JSONL 추가: ${relativePath(workMemoryLogJsonPath())}`);
  if (rotatedTo) {
    console.log(`이전 월 로그 archive: ${relativePath(rotatedTo)}`);
  }
}

main();

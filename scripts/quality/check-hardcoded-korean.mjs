import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { defineGuardExceptions } from "./guard-exception-policy.mjs";

const IGNORED_DIRS = new Set(["node_modules", ".next", "coverage", "build", "out"]);
const CODE_EXTENSIONS = new Set([".ts", ".tsx"]);

const EXCLUDED_PATH_EXCEPTIONS = defineGuardExceptions(
  "guard:korean",
  [
    {
      id: "i18n-message-catalog",
      pathPrefix: "app/i18n/",
      reason: "canonical localized message catalogs contain Korean by design",
      owner: "Lighthouse i18n message registry",
      reviewWhen:
        "review when localized message storage moves or catalogs gain a dedicated scanner",
    },
    {
      id: "agent-prompts",
      pathPrefix: "app/server/agent/",
      reason: "agent and judge prompts are generated-language instructions rather than UI literals",
      owner: "Lighthouse route AI generation",
      reviewWhen: "review when prompts move into a canonical prompt catalog",
    },
    ...[
      "interpret-cluster-narrative.ts",
      "interpret-gap-narrative.ts",
      "interpret-gap-network-domain.ts",
      "interpret-gap-network-content-narrative.ts",
    ].map((file) => ({
      id: `knowledge-map-prompt:${file}`,
      pathPrefix: `app/server/services/knowledge-map/${file}`,
      reason:
        "knowledge-map narrative prompts are generated-language instructions, not UI literals",
      owner: "Lighthouse knowledge-map generation",
      reviewWhen: "review when knowledge-map prompts move into a canonical prompt catalog",
    })),
    {
      id: "intent-qualitative-judge-prompt",
      pathPrefix: "app/server/ai-generation/intent-qualitative-judge.ts",
      reason: "the qualitative judge prompt is a generated-language instruction, not a UI literal",
      owner: "Lighthouse intent qualitative judgment",
      reviewWhen: "review when judge prompts move into a canonical prompt catalog",
    },
  ],
  { requiredMatchFields: ["pathPrefix"] },
);
// Regex: Korean syllable block range (가 U+AC00 – 힣 U+D7AF)
const KOREAN_IN_STRING = /(?:"|'|`)(?:[^"'`\\]|\\.)*[\uAC00-\uD7AF](?:[^"'`\\]|\\.)*(?:"|'|`)/;

export async function runHardcodedKoreanGuard(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const exceptions = options.exceptions
    ? defineGuardExceptions("guard:korean", options.exceptions, {
        requiredMatchFields: ["pathPrefix"],
      })
    : EXCLUDED_PATH_EXCEPTIONS;
  const violations = [];
  const matchedExceptionIds = new Set();

  async function walk(targetPath) {
    let targetStat;
    try {
      targetStat = await stat(targetPath);
    } catch {
      return;
    }

    if (targetStat.isDirectory()) {
      const entries = await readdir(targetPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
        await walk(path.join(targetPath, entry.name));
      }
      return;
    }

    if (!CODE_EXTENSIONS.has(path.extname(targetPath))) return;

    const rel = path.relative(root, targetPath).replaceAll(path.sep, "/");
    if (rel.includes("__tests__/") || /\.test\./.test(rel)) return;

    const contents = await readFile(targetPath, "utf8");
    const lines = contents.split("\n");
    const exception = exceptions.find((candidate) => rel.startsWith(candidate.pathPrefix));
    if (exception) {
      if (lines.some(hasGuardedKoreanLiteral)) matchedExceptionIds.add(exception.id);
      return;
    }

    lines.forEach((line, index) => {
      if (!hasGuardedKoreanLiteral(line)) return;
      violations.push({
        file: path.relative(root, targetPath),
        line: index + 1,
      });
    });
  }

  await walk(path.join(root, "app"));

  const staleExceptions = exceptions.filter((exception) => !matchedExceptionIds.has(exception.id));
  return {
    ok: violations.length === 0 && staleExceptions.length === 0,
    violations,
    staleExceptions,
  };
}

function hasGuardedKoreanLiteral(line) {
  if (line.includes("// i18n-ignore")) return false;
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
    return false;
  }
  return KOREAN_IN_STRING.test(line);
}

async function main() {
  const result = await runHardcodedKoreanGuard();
  if (result.ok) return;

  if (result.staleExceptions.length > 0) {
    console.error("[guard:korean] 사용되지 않는 예외 선언을 발견했습니다:");
    for (const exception of result.staleExceptions) {
      console.error(`  ${exception.id}: ${exception.pathPrefix}`);
    }
  }
  if (result.violations.length > 0) {
    console.error(`하드코딩된 한국어 문자열 ${result.violations.length}건을 발견했습니다:`);
    for (const violation of result.violations) {
      console.error(`  ${violation.file}:${violation.line}`);
    }
  }
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}

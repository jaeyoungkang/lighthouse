import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const ROOTS = ["app", "scripts", "eslint.config.mjs", "vitest.config.mts"];
const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "coverage",
  "build",
  "out",
  "docs/contracts/story-chain/evidence-ledgers/report",
]);
const CODE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".tsx"]);
const CHECKS = [
  { label: "eslint-disable", pattern: /eslint-disable(?:-next-line|-line)?/g },
  { label: "@ts-ignore", pattern: /@ts-ignore/g },
  { label: "@ts-expect-error", pattern: /@ts-expect-error/g },
  { label: ".skip()", pattern: /\b(?:describe|it|test)\.skip\s*\(/g },
];

const violations = [];

for (const root of ROOTS) {
  const fullPath = path.join(ROOT, root);
  await walk(fullPath);
}

if (violations.length > 0) {
  console.error("금지된 탈출구를 발견했습니다:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} ${violation.label}`);
  }
  process.exit(1);
}

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
  if (targetPath.includes(`${path.sep}scripts${path.sep}quality${path.sep}`)) return;

  const contents = await readFile(targetPath, "utf8");
  const lines = contents.split("\n");

  lines.forEach((line, index) => {
    for (const check of CHECKS) {
      if (check.pattern.test(line)) {
        violations.push({
          file: path.relative(ROOT, targetPath),
          line: index + 1,
          label: check.label,
        });
      }
      check.pattern.lastIndex = 0;
    }
  });
}

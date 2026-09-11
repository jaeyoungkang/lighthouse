// guard:ai-generation-gateway — production AI provider calls must pass through
// app/server/ai-generation/.
//
// Why this gate exists (#185): route deadlines, provider policy, and degraded
// fallbacks only become structural when model calls have a single chokepoint.
// Raw provider imports or direct generate/stream calls in arbitrary services
// make automatic reactions and judgment calls drift into separate reliability
// paths.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = [
  path.join(ROOT, "app", "api"),
  path.join(ROOT, "app", "lib"),
  path.join(ROOT, "app", "server"),
  path.join(ROOT, "packages"),
];
const ALLOWED_DIRS = [path.join(ROOT, "app", "server", "ai-generation")];
const CURRENT_GEMINI_OWNER = path.join(ROOT, "app", "server", "ai-generation", "gemini.ts");
const LEGACY_GEMINI_OWNER = path.join(ROOT, "app", "lib", "gemini.ts");
const ALLOW_HISTORICAL_OWNER_LAYOUT = process.argv
  .slice(2)
  .includes("--allow-historical-gemini-owner");
const LEGACY_ALLOWED_FILES = new Set();
try {
  await stat(CURRENT_GEMINI_OWNER);
} catch {
  if (ALLOW_HISTORICAL_OWNER_LAYOUT) LEGACY_ALLOWED_FILES.add(LEGACY_GEMINI_OWNER);
}

const AI_SDK_GENERATION_CALLS = [
  "streamText",
  "generateText",
  "streamObject",
  "generateObject",
  "embed",
  "embedMany",
  "generateImage",
  "experimental_generateImage",
  "transcribe",
  "experimental_transcribe",
  "rerank",
];

const PROVIDER_IMPORT_PATTERN =
  /import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+["'](@ai-sdk\/google|@ai-sdk\/openai|@google\/genai)["']/g;
const AI_NAMED_IMPORT_PATTERN = /import\s+(?!type\b)\{([\s\S]*?)\}\s+from\s+["']ai["']/g;
const AI_NAMESPACE_IMPORT_PATTERN = /import\s+\*\s+as\s+(\w+)\s+from\s+["']ai["']/g;
const GENERATE_CONTENT_CHAIN_PATTERN = /\.models\s*\.\s*generateContent\s*\(/g;
const GENERATE_CONTENT_CALL_PATTERN = /\bgenerateContent\s*\(/g;

const sourceFiles = [];
for (const dir of SCAN_DIRS) {
  await collectSourceFiles(dir);
}
sourceFiles.sort();

const violations = [];
for (const file of sourceFiles) {
  const contents = await readFile(file, "utf8");
  const rel = path.relative(ROOT, file);
  violations.push(...findAiGenerationGatewayViolations(rel, contents));
}

if (violations.length > 0) {
  console.error("[guard:ai-generation-gateway] gateway seam 밖의 AI provider 호출을 발견했습니다:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} ${violation.text}`);
  }
  console.error(
    "  AI provider 호출과 provider client factory는 app/server/ai-generation/에만 두세요.",
  );
  process.exit(1);
}

console.log(
  `[guard:ai-generation-gateway] OK (${sourceFiles.length}개 production source 스캔, gateway seam 밖 provider 호출 0건).`,
);

function isAllowedPath(targetPath) {
  return (
    LEGACY_ALLOWED_FILES.has(targetPath) ||
    ALLOWED_DIRS.some(
      (allowed) => targetPath === allowed || targetPath.startsWith(`${allowed}${path.sep}`),
    )
  );
}

export function findAiGenerationGatewayViolations(file, contents) {
  const fileViolations = [];
  const providerImports = findMatches(PROVIDER_IMPORT_PATTERN, contents);
  for (const match of providerImports) {
    fileViolations.push(buildViolation(file, contents, match.index, match[0]));
  }

  const aiGenerationLocals = collectAiGenerationLocals(contents);
  for (const localName of aiGenerationLocals) {
    const callPattern = new RegExp(`\\b${escapeRegExp(localName)}\\s*\\(`, "g");
    for (const match of findMatches(callPattern, contents)) {
      fileViolations.push(buildViolation(file, contents, match.index, match[0]));
    }
  }

  for (const match of findMatches(AI_NAMESPACE_IMPORT_PATTERN, contents)) {
    const namespaceName = match[1];
    const namespaceCallPattern = new RegExp(
      `\\b${escapeRegExp(namespaceName)}\\s*\\.\\s*(?:${AI_SDK_GENERATION_CALLS.map(
        escapeRegExp,
      ).join("|")})\\s*\\(`,
      "g",
    );
    for (const callMatch of findMatches(namespaceCallPattern, contents)) {
      fileViolations.push(buildViolation(file, contents, callMatch.index, callMatch[0]));
    }
  }

  for (const match of findMatches(GENERATE_CONTENT_CHAIN_PATTERN, contents)) {
    fileViolations.push(buildViolation(file, contents, match.index, match[0]));
  }

  if (providerImports.length > 0) {
    for (const match of findMatches(GENERATE_CONTENT_CALL_PATTERN, contents)) {
      fileViolations.push(buildViolation(file, contents, match.index, match[0]));
    }
  }

  return dedupeViolations(fileViolations);
}

function collectAiGenerationLocals(contents) {
  const locals = new Set();
  for (const match of findMatches(AI_NAMED_IMPORT_PATTERN, contents)) {
    for (const specifier of match[1].split(",")) {
      const [importedName, localName] = specifier
        .trim()
        .split(/\s+as\s+/)
        .map((part) => part.trim());
      if (!AI_SDK_GENERATION_CALLS.includes(importedName)) continue;
      locals.add(localName || importedName);
    }
  }
  return locals;
}

function buildViolation(file, contents, index, rawText) {
  return {
    file,
    line: lineNumberAt(contents, index),
    text: firstLine(rawText).trim(),
  };
}

function findMatches(pattern, contents) {
  pattern.lastIndex = 0;
  return [...contents.matchAll(pattern)];
}

function lineNumberAt(contents, index) {
  return contents.slice(0, index).split("\n").length;
}

function firstLine(text) {
  return text.split("\n")[0] ?? text;
}

function dedupeViolations(fileViolations) {
  const seen = new Set();
  const deduped = [];
  for (const violation of fileViolations) {
    const key = `${violation.file}:${violation.line}:${violation.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(violation);
  }
  return deduped;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function collectSourceFiles(targetPath) {
  let targetStat;
  try {
    targetStat = await stat(targetPath);
  } catch {
    return;
  }

  if (targetStat.isDirectory()) {
    if (isAllowedPath(targetPath)) return;
    const base = path.basename(targetPath);
    if (base === "node_modules" || base === "dist" || base === "__tests__") return;
    const entries = await readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      await collectSourceFiles(path.join(targetPath, entry.name));
    }
    return;
  }

  if (isAllowedPath(targetPath)) return;

  const base = path.basename(targetPath);
  if (base.endsWith(".test.ts") || base.endsWith(".test.tsx")) return;
  if (base.endsWith(".ts") || base.endsWith(".tsx")) {
    sourceFiles.push(targetPath);
  }
}

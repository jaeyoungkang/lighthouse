// The declarative dependency-cruiser rule owns public-auth message imports.
// This minimal custom half only covers the external Amplitude dynamic import,
// which dependency-cruiser does not include in the current TypeScript graph.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_ANALYTICS_FILES = [
  "app/lib/analytics/amplitude-unified-client.ts",
  "app/lib/analytics/client.ts",
  "app/lib/track.ts",
  "instrumentation-client.ts",
];

const STATIC_IMPORT_RE =
  /import\s+(?!type\b)(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|export\s+(?!type\b)[\s\S]*?\s+from\s+["']([^"']+)["']/g;
const DYNAMIC_AMPLITUDE_IMPORT_RE = /import\s*\(\s*["']@amplitude\/unified["']\s*\)/g;
const AMPLITUDE_UNIFIED_HELPER_FILE = "app/lib/analytics/amplitude-unified-client.ts";

export async function runLandingAuthSourceBoundaryGuard(options = {}) {
  const root = options.root ?? process.cwd();
  const analyticsFiles = options.analyticsFiles ?? DEFAULT_ANALYTICS_FILES;
  const violations = [];

  for (const relativeFile of analyticsFiles) {
    const file = path.join(root, relativeFile);
    const source = await readFile(file, "utf8");
    for (const importRecord of getStaticImportSpecifiers(source)) {
      if (importRecord.specifier === "@amplitude/unified") {
        violations.push({
          file: relativeFile,
          line: lineNumberAt(source, importRecord.index),
          reason: "eager-amplitude-sdk-import",
          text: importRecord.specifier,
          message:
            "Load @amplitude/unified with dynamic import from an event path; do not attach it to the first auth/landing client graph.",
        });
      }
    }
    if (relativeFile !== AMPLITUDE_UNIFIED_HELPER_FILE) {
      for (const importRecord of getDirectAmplitudeDynamicImports(source)) {
        violations.push({
          file: relativeFile,
          line: lineNumberAt(source, importRecord.index),
          reason: "direct-amplitude-sdk-dynamic-import",
          text: importRecord.text,
          message:
            "Route @amplitude/unified through app/lib/analytics/amplitude-unified-client.ts so the SDK stays lazy and retryable.",
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

async function main() {
  const result = await runLandingAuthSourceBoundaryGuard();

  if (!result.ok) {
    console.error("[guard:landing-auth-source-boundary] analytics SDK boundary drift:");
    for (const violation of result.violations) {
      console.error(`- ${violation.file}:${violation.line} [${violation.reason}]`);
      console.error(`  ${violation.text}`);
      console.error(`  ${violation.message}`);
    }
    process.exit(1);
  }

  console.log(
    `[guard:landing-auth-source-boundary] OK (${DEFAULT_ANALYTICS_FILES.length} analytics files; public auth messages are dependency-cruiser-owned).`,
  );
}

function getStaticImportSpecifiers(source) {
  const specifiers = [];
  STATIC_IMPORT_RE.lastIndex = 0;

  for (;;) {
    const match = STATIC_IMPORT_RE.exec(source);
    if (!match) break;
    const specifier = match[1] ?? match[2];
    if (specifier) specifiers.push({ specifier, index: match.index });
  }

  return specifiers;
}

function getDirectAmplitudeDynamicImports(source) {
  const imports = [];
  DYNAMIC_AMPLITUDE_IMPORT_RE.lastIndex = 0;

  for (;;) {
    const match = DYNAMIC_AMPLITUDE_IMPORT_RE.exec(source);
    if (!match) break;
    imports.push({ text: match[0], index: match.index });
  }

  return imports;
}

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

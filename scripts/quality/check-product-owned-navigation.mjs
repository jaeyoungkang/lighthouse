// guard:product-owned-navigation — user-visible detached targets must not be
// blank browser documents held behind async work. Route composition tests and
// Evidence Ledger rows own whether the product route itself is first-paint safe.
//
// @aspect aspect:immediate-navigation
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const DEFAULT_SCAN_ROOTS = ["app/(research)", "app/components", "app/lib", "app/stores"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const TEST_SEGMENTS = new Set(["__tests__", "__fixtures__"]);
const BLANK_WINDOW_RE = /\bwindow\s*\.\s*open\s*\(\s*["'`]about:blank["'`]/g;

export async function runProductOwnedNavigationGuard(options = {}) {
  const root = options.root ?? ROOT;
  const scanRoots = options.scanRoots ?? DEFAULT_SCAN_ROOTS;
  const violations = [];

  for (const scanRoot of scanRoots) {
    await scanPath(path.join(root, scanRoot), root, violations);
  }

  return { ok: violations.length === 0, violations };
}

async function scanPath(target, root, violations) {
  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolute = path.join(target, entry.name);
    const relative = normalizeRelativePath(path.relative(root, absolute));
    if (entry.isDirectory()) {
      if (TEST_SEGMENTS.has(entry.name)) continue;
      await scanPath(absolute, root, violations);
      continue;
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    const source = await readFile(absolute, "utf8");
    for (const match of source.matchAll(BLANK_WINDOW_RE)) {
      const line = lineNumberForIndex(source, match.index ?? 0);
      const text = source.split("\n")[line - 1]?.trim() ?? match[0];
      violations.push({
        file: relative,
        line,
        text,
      });
    }
  }
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split("\n").length;
}

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/");
}

async function main() {
  const result = await runProductOwnedNavigationGuard();
  if (!result.ok) {
    console.error("[guard:product-owned-navigation] blank window navigation hold 발견:");
    for (const violation of result.violations) {
      console.error(`- ${violation.file}:${String(violation.line)} ${violation.text}`);
    }
    console.error(
      "  user activation 직후 detached visible target은 /search, /citation, /similar, /gap?opening=1 같은 product-owned route여야 합니다. async POST 완료 전 about:blank를 붙잡는 구현은 aspect:immediate-navigation 위반입니다. product route의 auth/provider-free first paint는 route composition evidence로 별도 검증합니다.",
    );
    process.exit(1);
  }
  console.log("[guard:product-owned-navigation] OK (about:blank window handoff 0건).");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

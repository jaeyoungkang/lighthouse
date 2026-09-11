import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const GLOBALS_CSS_PATH = path.join(process.cwd(), "app/globals.css");
const DIRECT_USAGE_EXEMPT_PATHS = new Set<string>();

const ACTIVE_PALETTE_EXPECTATIONS = {
  background: "oklch(0.9911 0 0)",
  foreground: "oklch(0.1793 0.0026 325.68)",
  "surface-app": "oklch(0.9612 0 0)",
  "surface-research": "oklch(0.982 0.006 85)",
  "surface-canvas": "oklch(0.9911 0 0)",
  "surface-panel": "oklch(1 0 0)",
  "surface-panel-strong": "oklch(0.9491 0 0)",
  "surface-paper": "oklch(1 0 0)",
  "border-subtle": "oklch(0.9097 0 0)",
  "border-strong": "oklch(0.6996 0.0014 286.36)",
  "text-muted": "oklch(0.3791 0 0)",
  "text-subtle": "oklch(0.5313 0 0)",
  accent: "oklch(0.4598 0.0545 307.13)",
  "accent-soft": "oklch(0.9501 0.0155 306.41)",
  "accent-strong": "oklch(0.331 0.0534 307.41)",
  ring: "oklch(0.5699 0.055 307.39)",
} as const;

function readGlobalsCss() {
  return fs.readFileSync(GLOBALS_CSS_PATH, "utf8");
}

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath);
    return entry.isFile() ? [entryPath] : [];
  });
}

function uniqueMatches(source: string, pattern: RegExp) {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))];
}

describe("Moonlight OKLCH token layer", () => {
  it("keeps imported --ml-* values available while absorbing selected values into Lighthouse tokens", () => {
    const css = readGlobalsCss();

    const mlTokens = uniqueMatches(css, /^\s*(--ml-[\w-]+):/gm);
    const mlAliases = uniqueMatches(css, /^\s*--color-(ml-[\w-]+):\s*var\(--ml-[\w-]+\);/gm);

    expect(mlTokens).toHaveLength(150);
    expect(mlAliases).toHaveLength(150);

    for (const token of mlTokens) {
      expect(css).toContain(`--color-${token.slice(2)}: var(${token});`);
    }

    for (const [token, value] of Object.entries(ACTIVE_PALETTE_EXPECTATIONS)) {
      expect(css).toContain(`--${token}: ${value};`);
    }
  });

  it("keeps component code on Lighthouse canonical token names", () => {
    const files = walkFiles(path.join(process.cwd(), "app")).filter((file) => {
      if (file === GLOBALS_CSS_PATH) return false;
      if (file === __filename) return false;
      if (DIRECT_USAGE_EXEMPT_PATHS.has(file)) return false;
      return /\.(css|js|jsx|ts|tsx|mjs|cjs)$/.test(file);
    });

    const directUsages = files.flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return source.includes("--ml-") ? [file] : [];
    });

    expect(directUsages).toEqual([]);
  });
});

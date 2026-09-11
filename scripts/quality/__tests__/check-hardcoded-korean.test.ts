import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type ExceptionDeclaration = {
  id: string;
  pathPrefix: string;
  reason: string;
  owner: string;
  reviewWhen: string;
};

type GuardResult = {
  ok: boolean;
  violations: Array<{ file: string; line: number }>;
  staleExceptions: ExceptionDeclaration[];
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function loadGuard(): Promise<{
  runHardcodedKoreanGuard: (options: {
    root: string;
    exceptions: ExceptionDeclaration[];
  }) => Promise<GuardResult>;
}> {
  const modulePath = path.resolve(__dirname, "..", "check-hardcoded-korean.mjs");
  return (await import(pathToFileURL(modulePath).href)) as never;
}

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "hardcoded-korean-guard-"));
  roots.push(root);
  return root;
}

async function write(root: string, relative: string, contents: string): Promise<void> {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents, "utf8");
}

const promptException: ExceptionDeclaration = {
  id: "fixture-prompt",
  pathPrefix: "app/prompts/",
  reason: "fixture prompt text is generated-language instruction",
  owner: "fixture prompt workflow",
  reviewWhen: "review when the fixture prompt moves",
};

describe("hardcoded Korean guard exceptions", () => {
  it("keeps an exclusion live only while the excluded source has a guarded Korean literal", async () => {
    const root = await fixtureRoot();
    await write(
      root,
      "app/prompts/prompt.ts",
      `const prefix = "instruction";
export const prompt = prefix + "한국어 지시";`,
    );
    const { runHardcodedKoreanGuard } = await loadGuard();

    const active = await runHardcodedKoreanGuard({
      root,
      exceptions: [promptException],
    });
    expect(active).toEqual(
      expect.objectContaining({ ok: true, violations: [], staleExceptions: [] }),
    );

    await write(
      root,
      "app/prompts/prompt.ts",
      `const first = "alpha";
// 한국어 주석은 예외를 유지하지 않는다.
export const prompt = first + "omega";`,
    );
    const stale = await runHardcodedKoreanGuard({
      root,
      exceptions: [promptException],
    });

    expect(stale.ok).toBe(false);
    expect(stale.violations).toEqual([]);
    expect(stale.staleExceptions).toEqual([expect.objectContaining({ id: "fixture-prompt" })]);
  });

  it("still reports a Korean UI literal outside declared exclusions", async () => {
    const root = await fixtureRoot();
    await write(root, "app/prompts/prompt.ts", `export const prompt = "한국어 지시";`);
    await write(root, "app/page.ts", `export const label = "하드코딩";`);
    const { runHardcodedKoreanGuard } = await loadGuard();

    const result = await runHardcodedKoreanGuard({
      root,
      exceptions: [promptException],
    });

    expect(result.violations).toEqual([expect.objectContaining({ file: "app/page.ts", line: 1 })]);
  });

  it("scans TSX literals while ignoring comments and explicit line exemptions", async () => {
    const root = await fixtureRoot();
    await write(
      root,
      "app/card.tsx",
      `// "주석"
/* "블록 주석" */
 * "이어지는 주석"
export const ignored = "의도된 데이터"; // i18n-ignore
export const label = "사용자 라벨";`,
    );
    const { runHardcodedKoreanGuard } = await loadGuard();

    const result = await runHardcodedKoreanGuard({ root, exceptions: [] });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([expect.objectContaining({ file: "app/card.tsx", line: 5 })]);
  });

  it("keeps test fixtures outside the production scan", async () => {
    const root = await fixtureRoot();
    await write(root, "app/__tests__/fixture.ts", `export const label = "테스트";`);
    await write(root, "app/page.test.ts", `export const label = "테스트";`);
    const { runHardcodedKoreanGuard } = await loadGuard();

    const result = await runHardcodedKoreanGuard({
      root,
      exceptions: [],
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: true, violations: [], staleExceptions: [] }),
    );
  });
});

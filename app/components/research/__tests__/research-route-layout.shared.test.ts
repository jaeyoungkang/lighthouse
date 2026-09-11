import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RESEARCH_ROUTE_BODY_RAIL_CLASS,
  DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS,
  RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS,
  GAP_VIEW_CONTENT_SHELL_CLASS,
} from "@/app/components/research/research-route-layout.shared";

// 레이아웃 폭 계약을 "값"이 아니라 "구조"로 잠근다.
// - 문서 rail 폭은 shared 모듈 단일 출처에서만 온다 (무우회).
// - 읽기 rail 3종은 같은 폭을 공유한다.
// - 시각화 rail은 읽기 rail보다 충분히 넓다는 관계를 지킨다 (1px 우위는 불합격).
// 구체 픽셀 값(1080/1500)은 잠그지 않는다. 그 값이 좋은지의 기준은
// docs/design-standards.md(읽기 measure)가 정하고, 검사는 구조만 잠근다.

const SHARED_MODULE_PATH = path.join(
  process.cwd(),
  "app/components/research/research-route-layout.shared.ts",
);

// shared 모듈만 정의해야 하는 문서 rail 폭. 컴포넌트가 raw 리터럴로 우회하면 잡는다.
// 범위 한정: 이 두 리터럴만 governance 대상이고, 검사는 `app/` 트리의 정확 문자열만
// 본다. 동적 구성(`max-w-[${w}px]`), `app/` 밖 위치, 다른 px 표현은 잡지 않는다 —
// 단일 출처 강제의 1차 그물이지 전수 증명이 아니다.
const GOVERNED_RAIL_WIDTHS = ["max-w-[1080px]", "max-w-[1500px]"];

// 시각화 rail이 읽기 rail보다 "충분히" 넓다는 구조 floor. 1px 우위로는 통과하지
// 못하게 해서 "시각화용으로 넓은 rail"이라는 관계를 게이트가 일부라도 지킨다.
// 구체 폭(1080/1500)이 아니라 관계 임계값이라 design-standards doctrine(구조·관계는
// 잠그되 값은 안 잠금)과 일관된다. 임계값 자체는 자유롭게 revisit 가능하다.
const MIN_VISUALIZATION_WIDTH_RATIO = 1.2;

function railWidthPx(className: string): number {
  const match = className.match(/max-w-\[(\d+)px\]/);
  if (!match) throw new Error(`max-w-[<px>] width not found in: ${className}`);
  return Number(match[1]);
}

function walkFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath);
    return entry.isFile() ? [entryPath] : [];
  });
}

function isTestFile(file: string): boolean {
  return (
    file.includes(`${path.sep}__tests__${path.sep}`) ||
    /\.(test|spec|fixtures)\.[cm]?[jt]sx?$/.test(file)
  );
}

// i18n 메시지 카탈로그는 레이아웃 소스가 아니라 콘텐츠이며 레이아웃 리터럴의
// 단일-출처 governance 대상이 아니다.
function isContentCatalogFile(file: string): boolean {
  return file.includes(`${path.sep}i18n${path.sep}messages${path.sep}`);
}

describe("document layout width contract", () => {
  it("keeps the governed rail-width literals (1080/1500) only in the shared module", () => {
    const files = walkFiles(path.join(process.cwd(), "app")).filter((file) => {
      if (file === SHARED_MODULE_PATH) return false;
      if (isTestFile(file)) return false;
      if (isContentCatalogFile(file)) return false;
      return /\.(css|js|jsx|ts|tsx|mjs|cjs)$/.test(file);
    });

    const bypassUsages = files.filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return GOVERNED_RAIL_WIDTHS.some((width) => source.includes(width));
    });

    expect(bypassUsages).toEqual([]);
  });

  it("keeps reading rails on a single shared width", () => {
    const readingWidths = [
      RESEARCH_ROUTE_BODY_RAIL_CLASS,
      RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS,
      DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS,
    ].map(railWidthPx);

    for (const width of readingWidths) {
      expect(width).toBe(readingWidths[0]);
    }
  });

  it("keeps the visualization rail wider than the reading rail", () => {
    const visualization = railWidthPx(GAP_VIEW_CONTENT_SHELL_CLASS);
    const reading = railWidthPx(RESEARCH_ROUTE_BODY_RAIL_CLASS);
    // 1px 우위가 아니라 "충분히 넓다"는 관계를 잠근다 (구조 floor, 값 아님).
    expect(visualization).toBeGreaterThanOrEqual(reading * MIN_VISUALIZATION_WIDTH_RATIO);
  });
});

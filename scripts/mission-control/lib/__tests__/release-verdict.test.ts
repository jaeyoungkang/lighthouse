import { describe, it, expect } from "vitest";
import {
  buildServicePolicyCoverageDimension,
  formatReleaseVerdict,
  type DimensionReport,
  type ReleaseVerdictReport,
} from "../release-verdict";

const greenDim = (detail: string): DimensionReport => ({
  status: "green",
  criticalCount: 0,
  warningCount: 0,
  detail,
});

const sampleReport = (overrides: Partial<ReleaseVerdictReport> = {}): ReleaseVerdictReport => ({
  intent: greenDim("29/29 met"),
  acTrace: greenDim("clean"),
  servicePolicy: greenDim("1/1 complete"),
  aspect: greenDim("12/12 met"),
  release: "green",
  ...overrides,
});

// Strip ANSI escape sequences so axis-cluster assertions are colour-blind.
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, "");
}

describe("formatReleaseVerdict — contract cluster grouping (promise:release-verdict-aspect-integration AC7)", () => {
  it("groups dimensions into 종단축, 서비스 정책, and 횡단축 cluster headers", () => {
    const out = stripAnsi(formatReleaseVerdict(sampleReport()));
    const lines = out.split("\n");

    const longitudinalIdx = lines.findIndex((line) => line.includes("종단축 (Promise chain)"));
    const intentIdx = lines.findIndex((line) => line.includes("Intent verdict:"));
    const acTraceIdx = lines.findIndex((line) => line.includes("AC trace:"));
    const policyClusterIdx = lines.findIndex((line) => line.includes("서비스 정책"));
    const policyIdx = lines.findIndex((line) => line.includes("Policy coverage:"));
    const crossIdx = lines.findIndex((line) => line.includes("횡단축 (Aspect)"));
    const aspectIdx = lines.findIndex((line) => line.includes("Aspect:"));
    const releaseIdx = lines.findIndex((line) => line.includes("Release:"));

    // 종단축 header precedes its dimension rows
    expect(longitudinalIdx).toBeGreaterThanOrEqual(0);
    expect(intentIdx).toBeGreaterThan(longitudinalIdx);
    expect(acTraceIdx).toBeGreaterThan(intentIdx);

    // 서비스 정책은 Promise trace 뒤에서 별도 상태로 보이고, 횡단축보다 앞선다.
    expect(policyClusterIdx).toBeGreaterThan(acTraceIdx);
    expect(policyIdx).toBeGreaterThan(policyClusterIdx);
    expect(crossIdx).toBeGreaterThan(policyIdx);
    expect(aspectIdx).toBeGreaterThan(crossIdx);

    // Release line comes last
    expect(releaseIdx).toBeGreaterThan(aspectIdx);
  });

  it("blocks service policy coverage while a core-product Experience is unresolved", () => {
    expect(
      buildServicePolicyCoverageDimension([
        {
          id: "experience:search",
          slug: "search",
          title: "Search",
          scope: "core-product",
          servicePolicyCoverage: "unresolved",
          servicePolicyCoverageReview: "https://example.test/review",
        },
      ]),
    ).toEqual({
      status: "blocked",
      criticalCount: 1,
      warningCount: 0,
      detail: "0/1 complete · 1 unresolved",
    });
  });

  it("renders the Release status (ready when green, blocked when any dimension blocked)", () => {
    const greenOut = stripAnsi(formatReleaseVerdict(sampleReport()));
    expect(greenOut).toMatch(/Release:\s+ready/);

    const blockedOut = stripAnsi(
      formatReleaseVerdict(
        sampleReport({
          aspect: { ...greenDim("3/12 not-met"), status: "blocked" },
          release: "blocked",
        }),
      ),
    );
    expect(blockedOut).toMatch(/Release:\s+blocked/);
  });
});

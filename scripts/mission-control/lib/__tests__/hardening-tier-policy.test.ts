import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POLICY_PATH = resolve(
  __dirname,
  "../../../../docs/contracts/story-chain/hardening-tier-policy.md",
);
const POLICY = readFileSync(POLICY_PATH, "utf8");

describe("hardening-tier-policy.md (promise:hardening-tier-policy)", () => {
  it("defines critical-path AC criteria as a single labeled section (AC critical-path-criteria)", () => {
    expect(POLICY).toMatch(/##\s+1\.\s+Critical-path AC 정의/);
    expect(POLICY).toMatch(/한 줄에 박혀/);
    expect(POLICY).toMatch(/사용자가 즉시 다친다/);
  });

  it("names mutation tier pilot ledger and mutationScore convention with manual separation (AC manual-mutation-lane)", () => {
    expect(POLICY).toMatch(/##\s+2\.\s+Mutation testing 발동/);
    expect(POLICY).toMatch(/pilot/);
    expect(POLICY).toMatch(/수동 실행 workflow로 분리한다/);
    expect(POLICY).toMatch(/`workflow_dispatch`만 받는다/);
    expect(POLICY).toMatch(/예약·PR·push\s*실행은 두지 않는다/);
    expect(POLICY).toMatch(/mutationScore/);
    expect(POLICY).toMatch(/`respond-contract-mutation-pilot\.ledger\.yaml`가 소유/);
  });

  it("lists co-located negative test triggers for numeric-boundary critical-path ACs (AC negative-test-trigger)", () => {
    expect(POLICY).toMatch(/##\s+3\.\s+Co-located negative test 발동/);
    expect(POLICY).toMatch(/숫자 boundary/);
    expect(POLICY).toMatch(/search-results-fast-window/);
  });

  it("scopes property-based fuzz to deterministic helper/route ledgers and excludes live LLM judges (AC fuzz-trigger)", () => {
    expect(POLICY).toMatch(/##\s+4\.\s+Property-based fixture 발동/);
    expect(POLICY).toMatch(/deterministic helper/);
    expect(POLICY).toMatch(/live LLM judge에는 도입하지 않는다/);
  });
});

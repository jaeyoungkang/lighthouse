import { describe, expect, it } from "vitest";

import { StoryChainParseError, parsePromiseFile } from "@/app/server/services/story-chain/parser";

const FILE = "test://promise.md";

const HEAD = `---
id: promise:slug-test
slug: slug-test
title: Slug rule fixture
moment: moment:alignment-relation-observability
lane: admin
status: propagated
acRulesEnforced: true
acceptanceChecks:
  - acceptance-check:slug-test-AC_ID_HERE
verdict: met
---

# Slug rule fixture

## Promise

A fixture for AC slug + revision rules.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks
`;

function makePromise(acId: string, body: string): string {
  return (
    HEAD.replace("AC_ID_HERE", acId.replace(/^acceptance-check:slug-test-/, "")) +
    `\n### ${acId}\n\n${body}\n`
  );
}

describe("AcceptanceCheck slug + revision rules (promise:alignment-coherence-gate)", () => {
  it("parses an AC with revision and a valid meaning slug (AC ac-revision-field)", () => {
    const source = makePromise(
      "acceptance-check:slug-test-revision-field",
      `- description: ok\n- evidence: ok\n- revision: 1\n`,
    );
    const promise = parsePromiseFile({ source, file: FILE });
    expect(promise.acceptanceChecks).toHaveLength(1);
    expect(promise.acceptanceChecks[0].revision).toBe(1);
  });

  it("grandfathers an AC without revision when the promise omits acRulesEnforced (AC ac-revision-field)", () => {
    // Strip the acRulesEnforced flag from the fixture HEAD for this case.
    const grandfatherHead = HEAD.replace(/\nacRulesEnforced: true/, "").replace(
      "AC_ID_HERE",
      "ac1",
    );
    const source =
      grandfatherHead +
      `\n### acceptance-check:slug-test-ac1\n\n- description: ok\n- evidence: ok\n`;
    const promise = parsePromiseFile({ source, file: FILE });
    expect(promise.acceptanceChecks).toHaveLength(1);
    expect(promise.acceptanceChecks[0].revision).toBeUndefined();
  });

  it("rejects an AC without revision when the promise sets acRulesEnforced: true (AC ac-revision-field, grandfather loophole)", () => {
    const source = makePromise(
      "acceptance-check:slug-test-no-revision",
      `- description: ok\n- evidence: ok\n`,
    );
    expect(() => parsePromiseFile({ source, file: FILE })).toThrow(
      /every AC must declare a "revision" field/,
    );
  });

  it("rejects ^ac\\d+$ slug when revision is declared (AC ac-slug-rule)", () => {
    const source = makePromise(
      "acceptance-check:slug-test-ac1",
      `- description: ok\n- evidence: ok\n- revision: 1\n`,
    );
    expect(() => parsePromiseFile({ source, file: FILE })).toThrow(/rejects \^ac\\d\+\$ slug/);
  });

  it("rejects a slug suffix longer than 30 characters (AC ac-slug-rule)", () => {
    const source = makePromise(
      "acceptance-check:slug-test-abcdefghij-klmnopqrst-uvwxyzabcd",
      `- description: ok\n- evidence: ok\n- revision: 1\n`,
    );
    expect(() => parsePromiseFile({ source, file: FILE })).toThrow(/limit 30/);
  });

  it("rejects a slug suffix with more than 4 dash-separated words (AC ac-slug-rule)", () => {
    const source = makePromise(
      "acceptance-check:slug-test-a-b-c-d-e",
      `- description: ok\n- evidence: ok\n- revision: 1\n`,
    );
    expect(() => parsePromiseFile({ source, file: FILE })).toThrow(/limit 4/);
  });

  it("rejects a non-kebab-case slug suffix (AC ac-slug-rule)", () => {
    const source = makePromise(
      "acceptance-check:slug-test-Has_Underscore",
      `- description: ok\n- evidence: ok\n- revision: 1\n`,
    );
    expect(() => parsePromiseFile({ source, file: FILE })).toThrow(/kebab-case/);
  });

  it("rejects revision < 1 (AC ac-revision-field)", () => {
    const source = makePromise(
      "acceptance-check:slug-test-zero-rev",
      `- description: ok\n- evidence: ok\n- revision: 0\n`,
    );
    expect(() => parsePromiseFile({ source, file: FILE })).toThrow(/≥ 1/);
  });

  it("rejects duplicate AcceptanceCheck headings within the same promise (AC ac-slug-rule)", () => {
    const dup = HEAD.replace("AC_ID_HERE", "duplicate-rule");
    const source =
      dup +
      "\n### acceptance-check:slug-test-duplicate-rule\n\n- description: first\n- evidence: first\n- revision: 1\n" +
      "\n### acceptance-check:slug-test-duplicate-rule\n\n- description: second\n- evidence: second\n- revision: 1\n";
    expect(() => parsePromiseFile({ source, file: FILE })).toThrow(/declared more than once/);
  });

  it("rejects non-integer revision (AC ac-revision-field)", () => {
    const source = makePromise(
      "acceptance-check:slug-test-bad-rev",
      `- description: ok\n- evidence: ok\n- revision: 1.5\n`,
    );
    expect(() => parsePromiseFile({ source, file: FILE })).toThrow(StoryChainParseError);
  });
});

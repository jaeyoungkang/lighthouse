import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  SCHOLAR_SEARCH_REFERENCE_ENTRY_COUNT,
  SCHOLAR_SEARCH_REQUIRED_FAMILIES,
  parseServicePolicyCoverageMatrix,
} from "@/app/server/services/story-chain/service-policy-matrix";

const CANONICAL_MATRIX_FILE = path.resolve(
  process.cwd(),
  "docs/contracts/story-chain/service-policy-coverage/research-and-discovery.matrix.yaml",
);

function parseCanonicalMatrix(source = readFileSync(CANONICAL_MATRIX_FILE, "utf8")) {
  return parseServicePolicyCoverageMatrix({ source, file: CANONICAL_MATRIX_FILE });
}

describe("Service Policy Coverage Matrix v1", () => {
  it("covers all 54 reference entries across the canonical six search families", () => {
    const matrix = parseCanonicalMatrix();
    expect(matrix.coverageProfile.referenceEntryCount).toBe(SCHOLAR_SEARCH_REFERENCE_ENTRY_COUNT);
    expect(matrix.families.map((family) => family.id)).toEqual([
      ...SCHOLAR_SEARCH_REQUIRED_FAMILIES,
    ]);
    expect(matrix.families.map((family) => family.items.length)).toEqual([9, 10, 9, 10, 10, 7]);
    expect(
      new Set(
        matrix.families.flatMap((family) => family.items.flatMap((item) => item.referenceEntries)),
      ).size,
    ).toBe(54);
  });

  it("keeps current observation separate from disposition and exact-revision evidence", () => {
    const matrix = parseCanonicalMatrix();
    const items = matrix.families.flatMap((family) => family.items);
    expect(items.find((item) => item.id === "query-identifier-detection")).toMatchObject({
      referenceObservation: "not-met",
      observation: "not-met",
      reconciliation: "changed-since-audit",
      disposition: "unresolved",
    });
    expect(items.find((item) => item.id === "query-spelling-correction")).toMatchObject({
      referenceObservation: "not-met",
      observation: "met",
      reconciliation: "changed-since-audit",
      disposition: "owned",
    });
    expect(items.find((item) => item.id === "trust-partial-retrieval")).toMatchObject({
      observation: "unknown",
      reconciliation: "current-unknown",
      disposition: "unresolved",
    });
    expect(matrix.sources.every((source) => /^[0-9a-f]{40}$/u.test(source.revision))).toBe(true);
  });

  it("rejects missing reference rows, observation drift, and unknown evidence sources", () => {
    const source = readFileSync(CANONICAL_MATRIX_FILE, "utf8");
    expect(() =>
      parseCanonicalMatrix(source.replace(/^\s+measurement-automatic-go-no-go\t.*\n/mu, "")),
    ).toThrow(/reference coverage is missing entries: 54/);
    expect(() =>
      parseCanonicalMatrix(
        source.replace(
          "trust-partial-retrieval\t26\tnot-met\tunknown\tcurrent-unknown",
          "trust-partial-retrieval\t26\tnot-met\tunknown\tunchanged",
        ),
      ),
    ).toThrow(/unknown observation and current-unknown reconciliation must agree/);
    expect(() =>
      parseCanonicalMatrix(
        source.replace(
          "query-length\t1\tmet\tmet\tunchanged\t일반 검색어는 비어 있지 않아야 하며 UTF-8 1,024 bytes 이하로 제한된다.\tlighthouse-main",
          "query-length\t1\tmet\tmet\tunchanged\t일반 검색어는 비어 있지 않아야 하며 UTF-8 1,024 bytes 이하로 제한된다.\tmissing-source",
        ),
      ),
    ).toThrow(/evidence references unknown source "missing-source"/);
    expect(() =>
      parseCanonicalMatrix(
        source.replace("query-length\t1\tmet\tmet", "query-length\t1\tnot-met\tmet"),
      ),
    ).toThrow(/reference observation does not match entry 1/);
    expect(() => parseCanonicalMatrix(source.replace("query-length\t1", "query-bytes\t1"))).toThrow(
      /must preserve the canonical reference atom map/,
    );
  });
});

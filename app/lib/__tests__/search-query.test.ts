import { describe, expect, it } from "vitest";
import {
  createDefaultSearchQueryClauses,
  getEffectiveSearchQueryClauses,
  parseSearchQueryClauses,
} from "@/app/lib/search-query";

describe("parseSearchQueryClauses", () => {
  describe("comma query single intent (issue #525)", () => {
    it("keeps a comma-separated topical query as one search intent", () => {
      expect(parseSearchQueryClauses("machine learning, climate change")).toEqual([
        "machine learning, climate change",
      ]);
    });

    it("keeps a coordinated comma title as one search intent", () => {
      expect(parseSearchQueryClauses("Forced, Mixed, and Free Convection Regimes")).toEqual([
        "Forced, Mixed, and Free Convection Regimes",
      ]);
    });

    it("keeps comma-separated terms regardless of conjunction spelling", () => {
      expect(
        parseSearchQueryClauses("Supervised, Semi-supervised, or Unsupervised Learning"),
      ).toEqual(["Supervised, Semi-supervised, or Unsupervised Learning"]);
      expect(parseSearchQueryClauses("Structure, Dynamics, & Function of Proteins")).toEqual([
        "Structure, Dynamics, & Function of Proteins",
      ]);
      expect(parseSearchQueryClauses("Neither Forced, Mixed, nor Free Convection")).toEqual([
        "Neither Forced, Mixed, nor Free Convection",
      ]);
      expect(parseSearchQueryClauses("machine learning, android development")).toEqual([
        "machine learning, android development",
      ]);
      expect(parseSearchQueryClauses("machine learning, andén platforms")).toEqual([
        "machine learning, andén platforms",
      ]);
    });
  });

  describe("explicit multi-condition search", () => {
    it("keeps a title-prefix and following comma text in one query", () => {
      expect(
        parseSearchQueryClauses("Towards end-to-end automation of AI research, the ai scientist"),
      ).toEqual(["Towards end-to-end automation of AI research, the ai scientist"]);
    });

    it("splits semicolon-separated conditions while preserving commas inside each condition", () => {
      expect(
        parseSearchQueryClauses("Forced, Mixed, and Free Convection; boundary layers"),
      ).toEqual(["Forced, Mixed, and Free Convection", "boundary layers"]);
    });

    it("splits newline-separated conditions", () => {
      expect(parseSearchQueryClauses("deep learning\nreinforcement learning")).toEqual([
        "deep learning",
        "reinforcement learning",
      ]);
    });

    it("removes explicit separators when only one non-empty condition remains", () => {
      expect(parseSearchQueryClauses("  topic   model;")).toEqual(["topic model"]);
      expect(parseSearchQueryClauses("; topic")).toEqual(["topic"]);
      expect(parseSearchQueryClauses("topic;;;")).toEqual(["topic"]);
      expect(parseSearchQueryClauses(";;;")).toEqual([]);
    });
  });

  describe("existing behaviour is preserved", () => {
    it("returns a single multi-term clause for whitespace-only queries", () => {
      expect(parseSearchQueryClauses("large language model agents lifelong learning")).toEqual([
        "large language model agents lifelong learning",
      ]);
    });

    it("returns an empty list for an empty query", () => {
      expect(parseSearchQueryClauses("   ")).toEqual([]);
    });
  });
});

describe("createDefaultSearchQueryClauses", () => {
  it("builds one extractive clause for a comma-separated topical query", () => {
    const clauses = createDefaultSearchQueryClauses("machine learning, climate change");
    expect(clauses).toHaveLength(1);
    expect(clauses[0]).toMatchObject({
      rawClause: "machine learning, climate change",
      normalizedClause: "machine learning, climate change",
      isExtractive: true,
    });
  });
});

describe("getEffectiveSearchQueryClauses (normalized provider query)", () => {
  it("keeps a comma-separated topical query as a single effective clause", () => {
    expect(getEffectiveSearchQueryClauses({ query: "machine learning, climate change" })).toEqual([
      "machine learning, climate change",
    ]);
  });

  it("still strips a leading boilerplate phrase from one comma-containing query", () => {
    expect(
      getEffectiveSearchQueryClauses({ query: "Towards Fast, Cheap, and Robust Systems" }),
    ).toEqual(["Fast, Cheap, and Robust Systems"]);
  });

  it("uses the canonical clause after an explicit trailing separator", () => {
    expect(getEffectiveSearchQueryClauses({ query: "  topic   model;" })).toEqual(["topic model"]);
  });
});

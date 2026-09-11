import { describe, expect, it } from "vitest";
import {
  containsEpisteme3PaperRef,
  getEpistemePaperIdentityAliases,
  getReviewedAtForEpistemePaper,
  isEpisteme3PaperRef,
  matchesEpistemePaperIdentity,
  toEpisteme3PaperRef,
} from "@/app/lib/episteme-paper-ref";

describe("Episteme 3 paper references", () => {
  it("accepts E3 canonical, S2, DOI, arXiv, OpenAlex, and PubMed refs", () => {
    for (const ref of [
      "pap_native",
      "s2:42",
      "doi:10.1000/test",
      "arxiv:2401.00001",
      "oa:W123",
      "openalex:W123",
      "pmid:123",
    ]) {
      expect(isEpisteme3PaperRef(ref)).toBe(true);
    }
    expect(toEpisteme3PaperRef("42")).toBe("s2:42");
    expect(isEpisteme3PaperRef("legacy-paper")).toBe(false);
  });

  it("matches canonical and S2 aliases carried by one mapped paper", () => {
    const paper = {
      paperId: "42",
      source: { canonicalPaperId: "pap_native_42" },
      externalIds: { CorpusId: "42" },
    };

    expect(getEpistemePaperIdentityAliases(paper)).toEqual(["42", "s2:42", "pap_native_42"]);
    expect(matchesEpistemePaperIdentity(paper, "pap_native_42")).toBe(true);
    expect(matchesEpistemePaperIdentity(paper, "s2:42")).toBe(true);
  });

  it("resolves reviewed state through a canonical alias", () => {
    const reviewedAt = new Date("2026-09-03T00:00:00.000Z");
    const paper = {
      paperId: "42",
      source: { canonicalPaperId: "pap_native_42" },
      externalIds: { CorpusId: "42" },
    };

    expect(getReviewedAtForEpistemePaper(paper, new Map([["pap_native_42", reviewedAt]]))).toBe(
      reviewedAt,
    );
  });

  it("matches every provider-supported external paper reference alias", () => {
    const paper = {
      paperId: "pap_native",
      externalIds: {
        DOI: "10.1000/Test",
        ArXiv: "2401.00001",
        OpenAlex: "W123",
        PubMed: "987",
      },
    };

    for (const ref of [
      "doi:10.1000/test",
      "arxiv:2401.00001",
      "oa:W123",
      "openalex:W123",
      "pmid:987",
    ]) {
      expect(matchesEpistemePaperIdentity(paper, ref)).toBe(true);
    }
  });

  it("keeps E3-only library papers eligible for client availability", () => {
    expect(containsEpisteme3PaperRef([{ paperId: "pap_native" }])).toBe(true);
    expect(containsEpisteme3PaperRef([{ paperId: "legacy-paper" }])).toBe(false);
  });
});

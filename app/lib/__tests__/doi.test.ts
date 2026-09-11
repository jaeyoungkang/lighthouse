import { describe, expect, it } from "vitest";
import { buildDoiUrl, extractArxivIdFromDoi, normalizeDoiSearchInput } from "@/app/lib/doi";

describe("normalizeDoiSearchInput", () => {
  it("normalizes raw DOI, DOI label, and doi.org URLs", () => {
    expect(normalizeDoiSearchInput("10.1145/3375637")).toBe("10.1145/3375637");
    expect(normalizeDoiSearchInput("DOI: 10.1145/3375637.")).toBe("10.1145/3375637");
    expect(normalizeDoiSearchInput("https://doi.org/10.1145%2F3375637")).toBe("10.1145/3375637");
    expect(normalizeDoiSearchInput("https://doi.org/10.1145/3375637?download=true")).toBe(
      "10.1145/3375637",
    );
    expect(normalizeDoiSearchInput("https://doi.org/10.1145/3375637#section")).toBe(
      "10.1145/3375637",
    );
  });

  it("returns null for ordinary keyword searches", () => {
    expect(normalizeDoiSearchInput("agent memory retrieval")).toBeNull();
  });
});

describe("extractArxivIdFromDoi", () => {
  it("extracts arXiv identifiers from arXiv DOI inputs", () => {
    expect(extractArxivIdFromDoi("10.48550/arXiv.2408.06292")).toBe("2408.06292");
    expect(extractArxivIdFromDoi("10.48550/arXiv.2408.06292v2")).toBe("2408.06292");
  });

  it("returns null for non-arXiv DOI inputs", () => {
    expect(extractArxivIdFromDoi("10.1145/3375637")).toBeNull();
  });
});

describe("buildDoiUrl", () => {
  it("builds one canonical doi.org URL from raw and URL-shaped DOI values", () => {
    expect(buildDoiUrl("10.1145/3375637")).toBe("https://doi.org/10.1145/3375637");
    expect(buildDoiUrl(" https://doi.org/10.1145/3375637 ")).toBe(
      "https://doi.org/10.1145/3375637",
    );
    expect(buildDoiUrl("https://dx.doi.org/10.1145/3375637?download=true")).toBe(
      "https://doi.org/10.1145/3375637",
    );
  });
});

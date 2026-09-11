import { describe, expect, it } from "vitest";
import { readSearchPaperIds } from "../user-journey";

describe("readSearchPaperIds", () => {
  it("preserves first-rendered paper order and removes duplicate identities", () => {
    const html = [
      '<article data-paper-id="paper-2"></article>',
      '<article data-paper-id="paper-1"></article>',
      '<aside data-paper-id="paper-2"></aside>',
    ].join("");

    expect(readSearchPaperIds("2xx", html)).toEqual(["paper-2", "paper-1"]);
  });

  it("keeps a successful response without paper cards out of the green bucket", () => {
    expect(readSearchPaperIds("2xx", "<main>No results</main>")).toEqual([]);
    expect(readSearchPaperIds("2xx", null)).toEqual([]);
  });

  it("does not infer readiness from an unsuccessful response body", () => {
    expect(readSearchPaperIds("5xx", '<article data-paper-id="paper-1"></article>')).toBeNull();
  });

  it("preserves an empty rendered identity so report validation can fail closed", () => {
    expect(readSearchPaperIds("2xx", '<article data-paper-id=""></article>')).toEqual([""]);
  });
});

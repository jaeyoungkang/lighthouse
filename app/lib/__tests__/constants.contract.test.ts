// Co-located negative test for
// `promise:search-results-fast-window#acceptance-check:search-results-fast-window-initial-dom-window`.
// First applied negative-test ledger under `hardening-tier-policy.md` §3.
//
// Why this test exists: the AC encodes a value-as-promise ("정확히 10편").
// Sibling tests assert via the symbol name
// (`expect(...).toBe(SEARCH_RESULTS_INITIAL_VISIBLE_COUNT)`) — a tautology
// when both sides shift together. This file pins the *literal* `10` and
// also asserts the `@check-removes-fails:` comment above the constant
// declaration, so removing either signal trips vitest.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SEARCH_LIBRARY_NEAR_BAND_LIMIT,
  SEARCH_REACTION_INPUT_PAPER_LIMIT,
  SEARCH_RESULTS_INITIAL_VISIBLE_COUNT,
} from "@/app/lib/constants";

const CONSTANTS_SOURCE = readFileSync(resolve(__dirname, "../constants.ts"), "utf8");

describe("search-results-fast-window AC1: 정확히 10편 invariant (negative test)", () => {
  it("SEARCH_RESULTS_INITIAL_VISIBLE_COUNT is literally 10 — changing the value breaks the user-facing promise", () => {
    expect(SEARCH_RESULTS_INITIAL_VISIBLE_COUNT).toBe(10);
  });

  it("constants.ts carries the @check-removes-fails comment naming this AC, anchored to this test as the negative-test contract", () => {
    expect(CONSTANTS_SOURCE).toMatch(
      /\/\/\s*@check-removes-fails:\s*acceptance-check:search-results-fast-window-initial-dom-window/,
    );
    // The marker must sit above the SEARCH_RESULTS_INITIAL_VISIBLE_COUNT
    // declaration — otherwise it points at the wrong invariant.
    const markerIdx = CONSTANTS_SOURCE.indexOf(
      "@check-removes-fails: acceptance-check:search-results-fast-window-initial-dom-window",
    );
    const declarationIdx = CONSTANTS_SOURCE.indexOf(
      "export const SEARCH_RESULTS_INITIAL_VISIBLE_COUNT",
    );
    expect(markerIdx).toBeGreaterThan(-1);
    expect(declarationIdx).toBeGreaterThan(markerIdx);
  });
});

describe("search-reaction-summarizes-terrain-input-paper-cap: 반응 입력 상위 20편 invariant (negative test)", () => {
  it("SEARCH_REACTION_INPUT_PAPER_LIMIT is literally 20 — changing the value changes how much of the result pool the AI reaction reads", () => {
    expect(SEARCH_REACTION_INPUT_PAPER_LIMIT).toBe(20);
  });

  it("constants.ts carries the @check-removes-fails comment naming the search-reaction-summarizes-terrain-input-paper-cap AC, above the declaration", () => {
    expect(CONSTANTS_SOURCE).toMatch(
      /\/\/\s*@check-removes-fails:\s*acceptance-check:search-reaction-summarizes-terrain-input-paper-cap/,
    );
    const markerIdx = CONSTANTS_SOURCE.indexOf(
      "@check-removes-fails: acceptance-check:search-reaction-summarizes-terrain-input-paper-cap",
    );
    const declarationIdx = CONSTANTS_SOURCE.indexOf(
      "export const SEARCH_REACTION_INPUT_PAPER_LIMIT",
    );
    expect(markerIdx).toBeGreaterThan(-1);
    expect(declarationIdx).toBeGreaterThan(markerIdx);
  });
});

describe("library-neighborhood preflight hydration budget", () => {
  it("SEARCH_LIBRARY_NEAR_BAND_LIMIT is literally 40", () => {
    expect(SEARCH_LIBRARY_NEAR_BAND_LIMIT).toBe(40);
  });
});

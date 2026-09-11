import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { validateAuthorityReferences } from "../authority";
import { runGlossaryCli } from "../cli";
import {
  assertCurrentAuthorityFile,
  assertProjectionFile,
  assertRegistryFile,
  hasNonCurrentSourceSegment,
  preflightProjectionTarget,
} from "../file-ownership";
import {
  findGlossaryTerm,
  parseGlossaryRegistry,
  type GlossaryRegistry,
  validateI18nReferences,
} from "../model";
import { DOMAIN_OUTPUT, I18N_OUTPUT, README_OUTPUT, renderProjections } from "../projections";
const registryFixture: GlossaryRegistry = {
  version: 1,
  terms: [
    {
      id: "intent-check",
      ko: "의도 점검",
      en: "Intent Check",
      aliases: ["IC"],
      kind: "story-chain-concept",
      authorityRef: "docs/authority.md#intent-check",
    },
    {
      id: "my-library",
      ko: "내 라이브러리",
      en: "My Library",
      aliases: [],
      kind: "product-surface",
      authorityRef: "docs/authority.md#my-library",
    },
  ],
  i18nRefs: [{ termId: "my-library", key: "search.library.label" }],
};

describe("glossary registry", () => {
  it("looks up canonical terms by id, Korean, English, and alias", () => {
    const registry = parseGlossaryRegistry(registryFixture);

    expect(findGlossaryTerm(registry, "intent-check")?.id).toBe("intent-check");
    expect(findGlossaryTerm(registry, " 의도   점검 ")?.id).toBe("intent-check");
    expect(findGlossaryTerm(registry, "INTENT CHECK")?.id).toBe("intent-check");
    expect(findGlossaryTerm(registry, "ic")?.id).toBe("intent-check");
    expect(findGlossaryTerm(registry, "my-library")?.id).toBe("my-library");
    expect(findGlossaryTerm(registry, "missing")).toBeUndefined();
  });

  it("accepts product aliases used in prose, route kinds, and analytics events", () => {
    const fixture = structuredClone(registryFixture);
    fixture.terms.push({
      id: "similar-papers",
      ko: "비슷한 논문",
      en: "Similar Papers",
      aliases: [
        "유사 논문",
        "graph_neighbors_viewed",
        "product.graph_neighbors.viewed",
        "graph-neighbor papers",
      ],
      kind: "product-surface",
      authorityRef: "docs/authority.md#similar-papers",
    });

    const registry = parseGlossaryRegistry(fixture);

    expect(findGlossaryTerm(registry, "유사 논문")?.id).toBe("similar-papers");
    expect(findGlossaryTerm(registry, "graph_neighbors_viewed")?.id).toBe("similar-papers");
    expect(findGlossaryTerm(registry, "PRODUCT.GRAPH_NEIGHBORS.VIEWED")?.id).toBe("similar-papers");
    expect(findGlossaryTerm(registry, "graph-neighbor papers")?.id).toBe("similar-papers");
  });

  it.each(["bad/alias", "bad:alias", "bad@alias", "bad\u200Balias", "bad😀alias"])(
    "rejects alias characters outside the visible lookup vocabulary: %s",
    (unsafeAlias) => {
      const fixture = structuredClone(registryFixture);
      fixture.terms[0].aliases = [unsafeAlias];

      expect(() => parseGlossaryRegistry(fixture)).toThrow();
    },
  );

  it.each(["\u200B", "\u202E", "\u2028", "\u2029", "\u115F", "\u1160", "\u3164", "\uFFA0"])(
    "rejects invisible, bidi, and separator characters %#",
    (unsafeCharacter) => {
      const fixture = structuredClone(registryFixture);
      fixture.terms[0].ko = `의도${unsafeCharacter}점검`;

      expect(() => parseGlossaryRegistry(fixture)).toThrow();
    },
  );

  it("rejects duplicate ids and cross-term lookup collisions", () => {
    const duplicate = structuredClone(registryFixture);
    duplicate.terms[1].id = "intent-check";
    expect(() => parseGlossaryRegistry(duplicate)).toThrow("duplicate glossary term id");

    const collision = structuredClone(registryFixture);
    collision.terms[1].aliases = ["IC"];
    expect(() => parseGlossaryRegistry(collision)).toThrow("glossary lookup collision");

    const duplicateAlias = structuredClone(registryFixture);
    duplicateAlias.terms[0].aliases = ["IC", "IC"];
    expect(() => parseGlossaryRegistry(duplicateAlias)).toThrow("glossary alias collision");

    const canonicalAlias = structuredClone(registryFixture);
    canonicalAlias.terms[0] = { ...canonicalAlias.terms[0], id: "ic", aliases: ["IC"] };
    expect(() => parseGlossaryRegistry(canonicalAlias)).toThrow("glossary alias collision");
  });

  it("rejects missing term ids and duplicate owners in reference edges", () => {
    const unknown = structuredClone(registryFixture);
    unknown.i18nRefs[0].termId = "missing";
    expect(() => parseGlossaryRegistry(unknown)).toThrow("unknown glossary i18nRef term id");

    const duplicate = structuredClone(registryFixture);
    duplicate.i18nRefs.push({ ...duplicate.i18nRefs[0] });
    expect(() => parseGlossaryRegistry(duplicate)).toThrow("duplicate glossary i18nRef owner");
  });

  it("rejects the deferred codeRef surface from the core registry", () => {
    expect(() =>
      parseGlossaryRegistry({
        ...registryFixture,
        codeRefs: [],
      }),
    ).toThrow();
  });

  it("rejects non-canonical English digits and empty authority segments", () => {
    const digit = structuredClone(registryFixture);
    digit.terms[0].en = "Intent Check2";
    expect(() => parseGlossaryRegistry(digit)).toThrow();

    const emptySegment = structuredClone(registryFixture);
    emptySegment.terms[0].authorityRef = "docs//authority.md#intent-check";
    expect(() => parseGlossaryRegistry(emptySegment)).toThrow();

    const traversal = structuredClone(registryFixture);
    traversal.terms[0].authorityRef = "docs/../authority.md#intent-check";
    expect(() => parseGlossaryRegistry(traversal)).toThrow();
  });
});

describe("glossary authorities and projections", () => {
  it("uses CommonMark headings and GitHub duplicate slugs", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-glossary-"));
    await mkdir(path.join(root, "docs"));
    await writeFile(
      path.join(root, "docs/authority.md"),
      "# Intent Check\n\n# My Library\n\n# My Library\n",
    );
    const registry = parseGlossaryRegistry(registryFixture);

    await expect(validateAuthorityReferences(registry, root)).resolves.toBeUndefined();

    const broken = structuredClone(registry);
    broken.terms[1].authorityRef = "docs/authority.md#my-library-2";
    await expect(validateAuthorityReferences(broken, root)).rejects.toThrow(
      "broken glossary authorityRef",
    );
  });

  it("does not treat paragraph text as an authority heading", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-glossary-paragraph-"));
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs/authority.md"), "Not A Heading\n");
    const registry = parseGlossaryRegistry({
      ...registryFixture,
      terms: [
        {
          ...registryFixture.terms[0],
          authorityRef: "docs/authority.md#not-a-heading",
        },
      ],
      i18nRefs: [],
    });

    await expect(validateAuthorityReferences(registry, root)).rejects.toThrow(
      "broken glossary authorityRef",
    );
  });

  it("rejects retired, glossary-owned, and symlinked authorities", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-glossary-owner-"));
    const external = await mkdtemp(path.join(os.tmpdir(), "lighthouse-glossary-external-"));
    await mkdir(path.join(root, "docs/glossary"), { recursive: true });
    await mkdir(path.join(root, "docs/archive"), { recursive: true });
    await mkdir(path.join(root, "docs/archives"), { recursive: true });
    await mkdir(path.join(root, "docs/generated"), { recursive: true });
    await writeFile(path.join(root, "docs/glossary/authority.md"), "# Intent Check\n");
    await writeFile(path.join(root, "docs/archive/authority.md"), "# Intent Check\n");
    await writeFile(path.join(root, "docs/archives/authority.md"), "# Intent Check\n");
    await writeFile(path.join(root, "docs/generated/authority.md"), "# Intent Check\n");
    await writeFile(path.join(external, "authority.md"), "# Intent Check\n");
    await symlink(path.join(external, "authority.md"), path.join(root, "docs/linked.md"));

    for (const authorityRef of [
      "docs/glossary/authority.md#intent-check",
      "docs/archive/authority.md#intent-check",
      "docs/archives/authority.md#intent-check",
      "docs/generated/authority.md#intent-check",
      "docs/linked.md#intent-check",
    ]) {
      const registry = parseGlossaryRegistry({
        ...registryFixture,
        terms: [{ ...registryFixture.terms[0], authorityRef }],
        i18nRefs: [],
      });
      await expect(validateAuthorityReferences(registry, root)).rejects.toThrow();
    }
  });

  it("rejects symlinked registry and fixed projection owners", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-glossary-files-"));
    const external = await mkdtemp(path.join(os.tmpdir(), "lighthouse-glossary-target-"));
    await mkdir(path.join(root, "docs/glossary"), { recursive: true });
    await mkdir(path.join(root, "app/domain"), { recursive: true });
    await writeFile(path.join(external, "terms.json"), "{}\n");
    await writeFile(path.join(external, "projection.ts"), "export {};\n");
    const registryPath = path.join(root, "docs/glossary/terms.json");
    const projectionPath = path.join(root, "app/domain/projection.ts");
    await symlink(path.join(external, "terms.json"), registryPath);
    await symlink(path.join(external, "projection.ts"), projectionPath);

    await expect(assertRegistryFile(registryPath, root)).rejects.toThrow();
    await expect(assertProjectionFile(projectionPath, root)).rejects.toThrow();
    await expect(preflightProjectionTarget(projectionPath, root)).rejects.toThrow();
  });

  it("accepts exact regular owners and a missing projection below an exact directory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-glossary-valid-files-"));
    await mkdir(path.join(root, "docs/glossary"), { recursive: true });
    await mkdir(path.join(root, "docs/current"), { recursive: true });
    await mkdir(path.join(root, "app/domain"), { recursive: true });
    const registryPath = path.join(root, "docs/glossary/terms.json");
    const authorityPath = path.join(root, "docs/current/authority.md");
    const projectionPath = path.join(root, "app/domain/projection.ts");
    await writeFile(registryPath, "{}\n");
    await writeFile(authorityPath, "# Current\n");
    await writeFile(projectionPath, "export {};\n");

    await expect(assertRegistryFile(registryPath, root)).resolves.toBeUndefined();
    await expect(assertCurrentAuthorityFile(authorityPath, root)).resolves.toBeUndefined();
    await expect(assertProjectionFile(projectionPath, root)).resolves.toBeUndefined();
    await expect(
      preflightProjectionTarget(path.join(root, "app/domain/new-projection.ts"), root),
    ).resolves.toBeUndefined();
  });

  it("rejects unexpected registry owners, directories, missing parents, and repository escapes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-glossary-boundaries-"));
    const external = await mkdtemp(path.join(os.tmpdir(), "lighthouse-glossary-escape-"));
    await mkdir(path.join(root, "docs/glossary"), { recursive: true });
    await mkdir(path.join(root, "app/domain"), { recursive: true });
    const unexpectedRegistry = path.join(root, "docs/glossary/other.json");
    const externalFile = path.join(external, "projection.ts");
    await writeFile(unexpectedRegistry, "{}\n");
    await writeFile(externalFile, "export {};\n");
    await writeFile(path.join(root, "app/not-a-directory"), "file\n");

    await expect(assertRegistryFile(unexpectedRegistry, root)).rejects.toThrow(
      "unexpected glossary registry owner: docs/glossary/other.json",
    );
    await expect(assertProjectionFile(path.join(root, "app/domain"), root)).rejects.toThrow(
      "glossary owner must be a regular file",
    );
    await expect(
      preflightProjectionTarget(path.join(root, "app/not-a-directory/output.ts"), root),
    ).rejects.toThrow("ENOTDIR");
    await expect(assertProjectionFile(externalFile, root)).rejects.toThrow(
      "glossary owner escapes the repository",
    );
  });

  it("classifies retired authority path segments without substring false positives", () => {
    for (const segment of ["archive", "archives", "review", "generated", "glossary"]) {
      expect(hasNonCurrentSourceSegment(`docs/${segment}/authority.md`)).toBe(true);
    }
    expect(hasNonCurrentSourceSegment("docs/reviewer/authority.md")).toBe(false);
    expect(hasNonCurrentSourceSegment("docs/current/authority.md")).toBe(false);
  });

  it("checks actual message keys and canonical Korean values", () => {
    const registry = parseGlossaryRegistry(registryFixture);
    expect(() => {
      validateI18nReferences(registry, {
        "search.library.label": "내 라이브러리",
      });
    }).not.toThrow();
    expect(() => {
      validateI18nReferences(registry, {});
    }).toThrow("broken glossary i18nRef");
    expect(() => {
      validateI18nReferences(registry, {
        "search.library.label": "라이브러리",
      });
    }).toThrow("must equal canonical ko");
  });

  it("projects every term and reference into the three fixed outputs", async () => {
    const registry = parseGlossaryRegistry(registryFixture);
    const projections = await renderProjections(registry);

    expect(Object.keys(projections).sort()).toEqual(
      [README_OUTPUT, DOMAIN_OUTPUT, I18N_OUTPUT].sort(),
    );
    for (const term of registry.terms) {
      expect(projections[README_OUTPUT]).toMatch(new RegExp(`\\| ${term.id}\\s+\\|`));
      expect(projections[DOMAIN_OUTPUT]).toContain(JSON.stringify(term.id));
    }
    for (const reference of registry.i18nRefs) {
      expect(projections[I18N_OUTPUT]).toContain(JSON.stringify(reference.key));
      expect(projections[I18N_OUTPUT]).toContain(JSON.stringify(reference.termId));
    }
    expect(projections[README_OUTPUT]).toMatch(
      /\| intent-check\s+\| 의도 점검\s+\| Intent Check\s+\| IC\s+\| story-chain-concept \| \[source\]\(\.\.\/authority\.md#intent-check\) \|/,
    );
    expect(projections[README_OUTPUT]).toMatch(
      /\| my-library\s+\| 내 라이브러리 \| My Library\s+\| —\s+\| product-surface\s+\| \[source\]\(\.\.\/authority\.md#my-library\)\s+\|/,
    );
    expect(projections[DOMAIN_OUTPUT]).toContain(
      "export type GlossaryTermId = (typeof GLOSSARY_TERM_IDS)[number];",
    );
    expect(projections[I18N_OUTPUT]).toContain(
      "as const satisfies readonly {\n  termId: GlossaryTermId;\n  key: MessageKey;\n}[];",
    );
  });

  it("resolves current product labels and analytics names to the same glossary terms", async () => {
    const source = await readFile("docs/glossary/terms.json", "utf8");
    const registry = parseGlossaryRegistry(JSON.parse(source) as unknown);
    const addedTermIds = [
      "similar-papers",
      "citation-lineage",
      "route-ai-comment",
      "result-terrain",
      "research-gap",
      "representative-paper",
      "research-term",
      "inline-analysis",
    ];

    for (const termId of addedTermIds) {
      const term = findGlossaryTerm(registry, termId);
      expect(term?.aliases.length, `${termId} aliases`).toBeGreaterThan(0);
      expect(term?.authorityRef, `${termId} authority`).toMatch(/^docs\/.+\.md#[a-z0-9-]+$/);
    }

    expect(findGlossaryTerm(registry, "비슷한 논문")?.id).toBe("similar-papers");
    expect(findGlossaryTerm(registry, "graph_neighbors_viewed")?.id).toBe("similar-papers");
    expect(findGlossaryTerm(registry, "similar_papers_opened")?.id).toBe("similar-papers");
    expect(findGlossaryTerm(registry, "인용 계보")?.id).toBe("citation-lineage");
    expect(findGlossaryTerm(registry, "citation_lineage_opened")?.id).toBe("citation-lineage");
    // Human decision (2026-08-24): "ai-reaction은 레거시 표현이다. ai-comment가 맞다"
    // Legacy reaction vocabulary resolves to the canonical route-ai-comment term.
    expect(findGlossaryTerm(registry, "AI 반응")?.id).toBe("route-ai-comment");
    expect(findGlossaryTerm(registry, "ai-reaction")?.id).toBe("route-ai-comment");
    expect(findGlossaryTerm(registry, "반응")?.id).toBe("route-ai-comment");
    expect(findGlossaryTerm(registry, "AI 코멘트")).toMatchObject({
      id: "route-ai-comment",
      authorityRef:
        "docs/contracts/story-chain/promises/route-view-ai-comment-inline-surface.md#promise",
    });
  });

  it("keeps the Human-approved product-surface i18n owners in the real registry", async () => {
    const source = await readFile("docs/glossary/terms.json", "utf8");
    const registry = parseGlossaryRegistry(JSON.parse(source) as unknown);
    expect(registry.i18nRefs).toEqual([
      {
        termId: "my-library",
        key: "search.label.research-route-search-bar.libraryList.label",
      },
      {
        termId: "my-library",
        key: "search.label.library-context-source.internalReviewedFolder",
      },
      {
        termId: "my-research-proximity",
        key: "search.label.search-result-item.myResearchProximity",
      },
      {
        termId: "similar-papers",
        key: "search.label.search-result-item.findSimilar",
      },
      {
        termId: "similar-papers",
        key: "search.label.search-result-item.graphNeighbors",
      },
      {
        termId: "similar-papers",
        key: "search.label.graph-neighbors.kicker",
      },
      {
        termId: "similar-papers",
        key: "document.label.rendering.graphNeighbors",
      },
      {
        termId: "citation-lineage",
        key: "search.label.search-result-item.citationLineage.lineage",
      },
      {
        termId: "citation-lineage",
        key: "document.label.rendering.citationLineage",
      },
      {
        termId: "research-gap",
        key: "commitment.graphSample.output.gap.label",
      },
      {
        termId: "representative-paper",
        key: "gapNetwork.label.gap-network-report.focusedClusterRepresentativePapers",
      },
      {
        termId: "representative-paper",
        key: "search.label.search-view-content.facets.representative",
      },
      {
        termId: "representative-paper",
        key: "commitment.graphSample.output.representative.label",
      },
      {
        termId: "research-term",
        key: "commitment.graphSample.output.terms.label",
      },
    ]);
  });

  it("rejects stray operands for fixed commands", async () => {
    await expect(runGlossaryCli(["check", "unexpected"])).rejects.toThrow(
      "check does not accept operands",
    );
  });

  it("prints successful lookup output and rejects missing queries", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await expect(runGlossaryCli(["lookup", "My", "Library"])).resolves.toBeUndefined();
      expect(log).toHaveBeenLastCalledWith(expect.stringContaining('"id": "my-library"'));
      await expect(runGlossaryCli(["lookup"])).rejects.toThrow("glossary query is required");
      await expect(runGlossaryCli(["lookup", "missing"])).rejects.toThrow(
        "unknown glossary term: missing",
      );
    } finally {
      log.mockRestore();
    }
  });

  it("rejects the deferred mechanical naming command", async () => {
    await expect(runGlossaryCli(["name", "pascal", "My Library"])).rejects.toThrow(
      "usage: npm run glossary -- <check|generate|lookup QUERY>",
    );
  });
});

import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  mergeKnowledgeObjects,
  RELATION_TYPES,
  renderKnowledgeObjectBlock,
  renderKnowledgeObjectStore,
  validateKnowledgeObjectStore,
  validateStructuredKnowledgeCandidate,
  type KnowledgeObject,
} from "../knowledge-object";

const ROOT = process.cwd();

function object(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "product.example",
    lifecycle: "shared-consolidated",
    plane: "product",
    kind: "concept",
    title: "Example",
    aliases: ["sample"],
    statement: "A stable explanation.",
    scope: ["included"],
    non_scope: ["excluded"],
    forces: ["a real tension"],
    rejected_alternatives: [{ alternative: "copy current state", reason: "it becomes stale" }],
    authority_refs: ["docs/product-identity.md"],
    grounding: [
      {
        type: "commit",
        ref: "0a4ee4fae9f4dcdcd66f8eaebbabe11772080179",
        path: "docs/product-identity.md",
        note: "grounded example",
      },
    ],
    relations: [],
    temporal_status: "current",
    evolution: [{ date: "2026-08-13", note: "created" }],
    refresh_conditions: ["authority changes"],
    answers: ["Why does this exist?"],
    legacy_refs: [],
    ...overrides,
  };
}

function candidate(blocks: string): string {
  return `---
consolidation: structured
extraction_outcome: create
review_summary: reviewed explanation
review_checks:
  command_free: pass
  one_pr_falsification: pass
  verdict_free: pass
  second_situation: pass
  single_subject: pass
  deletion: pass
---

${blocks}`;
}

describe("structured Project Knowledge objects", () => {
  it("validates the organized shared projection and its model-case relations", () => {
    const markdown = readFileSync(
      path.join(ROOT, "docs/project-knowledge/knowledge-objects.md"),
      "utf8",
    );
    const validation = validateKnowledgeObjectStore(markdown);

    expect(validation.reasons).toEqual([]);
    expect(new Set(validation.records.map(({ object }) => object.plane))).toEqual(
      new Set(["product", "product-making"]),
    );
    for (const plane of ["product", "product-making"] as const) {
      expect(
        new Set(
          validation.records
            .filter(({ object }) => object.plane === plane)
            .map(({ object }) => object.kind),
        ),
      ).toEqual(new Set(["concept", "model", "case"]));
    }
    expect(
      new Set(
        validation.records.flatMap(({ object }) =>
          object.relations.map((relation) => relation.type),
        ),
      ),
    ).toEqual(new Set(RELATION_TYPES));

    const objects = new Map(
      validation.records.map(({ object: knowledgeObject }) => [
        knowledgeObject.id,
        knowledgeObject,
      ]),
    );
    expect(
      objects
        .get("product.gap-report-recoverable-artifact")
        ?.relations.some(
          (relation) =>
            relation.type === "produced_by" &&
            relation.target === "product-making.gap-report-recovery-propagation",
        ),
    ).toBe(true);
    expect(
      objects
        .get("product-making.executable-contract-evidence")
        ?.relations.some(
          (relation) =>
            relation.type === "evidenced_by" &&
            relation.target === "product-making.evidence-ledger-yaml-cutover",
        ),
    ).toBe(true);
    expect(
      objects
        .get("product-making.owner-routed-implementation-context")
        ?.relations.filter((relation) => relation.type === "evidenced_by")
        .map((relation) => relation.target),
    ).toEqual([
      "product-making.gap-report-recovery-propagation",
      "product-making.bounded-implementation-context-evaluation",
    ]);
  });

  it("rejects duplicate ids and unknown relation targets", () => {
    const duplicate = renderKnowledgeObjectStore([object(), object()]);
    const unknown = renderKnowledgeObjectStore([
      object({ relations: [{ type: "evidenced_by", target: "product.missing" }] }),
    ]);

    expect(validateKnowledgeObjectStore(duplicate, { verifyGrounding: false }).reasons).toContain(
      "duplicate-id:product.example:2",
    );
    expect(validateKnowledgeObjectStore(unknown, { verifyGrounding: false }).reasons).toContain(
      "unknown-relation-target:product.example:product.missing",
    );
  });

  it("rejects invalid enums, authority paths, and grounding commits", () => {
    const invalidPlane = renderKnowledgeObjectStore([object()]).replace(
      "plane: product",
      "plane: project",
    );
    const invalidAuthority = renderKnowledgeObjectStore([
      object({ authority_refs: ["../outside.md"] }),
    ]);
    const invalidGrounding = renderKnowledgeObjectStore([
      object({
        grounding: [
          {
            type: "commit",
            ref: "0000000000000000000000000000000000000000",
            path: "docs/product-identity.md",
            note: "missing commit",
          },
        ],
      }),
    ]);
    const abbreviatedGrounding = renderKnowledgeObjectStore([
      object({
        grounding: [
          {
            type: "commit",
            ref: "0a4ee4f",
            path: "docs/product-identity.md",
            note: "abbreviated commit",
          },
        ],
      }),
    ]);
    const invalidAnchor = renderKnowledgeObjectStore([
      object({ authority_refs: ["docs/product-identity.md#Missing-Heading"] }),
    ]);

    expect(
      validateKnowledgeObjectStore(invalidPlane, { verifyGrounding: false }).reasons[0],
    ).toContain("plane must be one of product, product-making");
    expect(
      validateKnowledgeObjectStore(invalidAuthority, { verifyGrounding: false }).reasons,
    ).toContain("invalid-authority-ref:product.example:../outside.md");
    expect(validateKnowledgeObjectStore(invalidGrounding).reasons).toContain(
      "invalid-grounding-commit:product.example:0000000000000000000000000000000000000000:docs/product-identity.md",
    );
    expect(
      validateKnowledgeObjectStore(abbreviatedGrounding, { verifyGrounding: false }).reasons[0],
    ).toContain("full 40-character commit SHA");
    expect(
      validateKnowledgeObjectStore(invalidAnchor, { verifyGrounding: false }).reasons,
    ).toContain("invalid-authority-ref:product.example:docs/product-identity.md#Missing-Heading");
  });

  it("requires disputed and superseded states to carry their counterevidence graph", () => {
    const disputed = renderKnowledgeObjectStore([object({ temporal_status: "disputed" })]);
    const superseded = renderKnowledgeObjectStore([object({ temporal_status: "superseded" })]);

    expect(validateKnowledgeObjectStore(disputed, { verifyGrounding: false }).reasons).toContain(
      "disputed-without-challenge:product.example",
    );
    expect(validateKnowledgeObjectStore(superseded, { verifyGrounding: false }).reasons).toContain(
      "superseded-without-current-successor:product.example",
    );
  });

  it("enforces the declared source and target shape of every typed relation", () => {
    const productCase = object({
      id: "product.example-case",
      kind: "case",
      relations: [{ type: "serves", target: "product.example" }],
    });
    const store = renderKnowledgeObjectStore([object(), productCase]);

    expect(validateKnowledgeObjectStore(store, { verifyGrounding: false }).reasons).toContain(
      "invalid-relation-shape:product.example-case:serves:product.example",
    );
  });

  it("requires a current same-kind successor for a superseded explanation", () => {
    const superseded = object({
      id: "product.old-model",
      kind: "model",
      temporal_status: "superseded",
    });
    const historicalSuccessor = object({
      id: "product.new-model",
      kind: "model",
      temporal_status: "historical",
      relations: [{ type: "supersedes", target: "product.old-model" }],
    });
    const store = renderKnowledgeObjectStore([superseded, historicalSuccessor]);
    const reasons = validateKnowledgeObjectStore(store, { verifyGrounding: false }).reasons;

    expect(reasons).toContain(
      "invalid-relation-shape:product.new-model:supersedes:product.old-model",
    );
    expect(reasons).toContain("superseded-without-current-successor:product.old-model");
  });

  it.each([
    "command_free",
    "one_pr_falsification",
    "verdict_free",
    "second_situation",
    "single_subject",
    "deletion",
  ])("rejects an unpassed shadow-canon review check: %s", (check) => {
    const store = renderKnowledgeObjectStore([object()]);
    expect(() =>
      validateStructuredKnowledgeCandidate(
        candidate(store).replace(`${check}: pass`, `${check}: pending`),
        { verifyGrounding: false },
      ),
    ).toThrow(`review_checks.${check} must be pass`);
  });

  it("creates and revises objects only against the exact prior digest", () => {
    const current = renderKnowledgeObjectStore([object()]);
    const currentRecord = validateKnowledgeObjectStore(current, {
      verifyGrounding: false,
    }).records[0];
    const revision = object({
      statement: "A revised stable explanation.",
      revises_digest: currentRecord.digest,
    });
    const revisionRecord = validateStructuredKnowledgeCandidate(
      candidate(renderKnowledgeObjectBlock(revision, { includeRevision: true })),
      { verifyGrounding: false },
    ).records;

    const merged = mergeKnowledgeObjects(current, revisionRecord, {
      verifyGrounding: false,
    });
    expect(
      validateKnowledgeObjectStore(merged, { verifyGrounding: false }).records[0]?.object.statement,
    ).toBe("A revised stable explanation.");

    const staleRevision = revisionRecord.map((record) => ({
      ...record,
      object: { ...record.object, revises_digest: "0".repeat(64) },
    }));
    expect(() => mergeKnowledgeObjects(current, staleRevision, { verifyGrounding: false })).toThrow(
      "revision digest mismatch",
    );
  });
});

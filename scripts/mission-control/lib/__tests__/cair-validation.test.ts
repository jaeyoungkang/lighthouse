import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  collectChangedFiles,
  createRepositoryView,
  runValidateCairCli,
  shouldRunValidateCairCli,
} from "../../mc-validate-cair";
import { parseCairRecords, validateCairChanges, validateCairRecord } from "../cair-validation";

function createRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "lighthouse-cair-"));
  mkdirSync(path.join(root, "docs/contracts/story-chain/promises"), { recursive: true });
  mkdirSync(path.join(root, "docs/contracts/story-chain/aspects"), { recursive: true });
  mkdirSync(path.join(root, "docs/architecture-fitness"), { recursive: true });
  mkdirSync(path.join(root, "scripts/quality"), { recursive: true });
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ scripts: { "guard:example": "node scripts/quality/example.mjs" } }),
  );
  writeFileSync(path.join(root, "scripts/quality/example.mjs"), "export {};\n");
  writeFileSync(
    path.join(root, "docs/contracts/story-chain/aspects/example.md"),
    "---\nid: aspect:example\n---\n",
  );
  return root;
}

function noneRecord(overrides = ""): string {
  return `## Contract Architecture Impact Review

Contract delta: keep the current owner while clarifying one approved contract.
Verdict: none
Affected axes: Source of truth and authority; State lifetime and recovery
Existing-boundary evidence: the current route and store already enforce the invariant.
Human decision required: no
${overrides}`;
}

function constrainedRecord(overrides = ""): string {
  return `## Contract Architecture Impact Review

Contract delta: strengthen the existing validation boundary.
Verdict: constrain-existing
Affected axes and current owners: Source of truth and authority; Observability and audit — package scripts and the quality workflow remain the current owners.
Decision: keep the existing topology and add a deterministic guard.
Rejected alternative: do not add an LLM judge or a parallel registry.
Evidence and structural defense: npm run guard:example and \`scripts/quality/example.mjs\`.
Human decision required: no
${overrides}`;
}

function firstRecord(source: string) {
  return parseCairRecords("docs/record.md", source)[0];
}

describe("CAIR record syntax", () => {
  it("accepts canonical none and constrain-existing records", () => {
    const root = createRepo();
    for (const source of [noneRecord(), constrainedRecord()]) {
      expect(validateCairRecord(root, firstRecord(source), source)).toEqual([]);
    }
  });

  it("accepts the exact non-semantic marker for a none record", () => {
    const root = createRepo();
    const source = noneRecord().replace(
      "Affected axes: Source of truth and authority; State lifetime and recovery",
      "Affected axes: none (non-semantic edit)",
    );

    expect(validateCairRecord(root, firstRecord(source), source)).toEqual([]);
  });

  it("rejects unknown verdicts, missing fields, private axes, and informal Human answers", () => {
    const root = createRepo();
    const source = noneRecord()
      .replace("Verdict: none", "Verdict: maybe")
      .replace(
        "Affected axes: Source of truth and authority; State lifetime and recovery",
        "Affected axes: Private cache magic",
      )
      .replace("Existing-boundary evidence: the current route", "Other: the current route")
      .replace("Human decision required: no", "Human decision required: probably not");
    const record = firstRecord(source);

    expect(validateCairRecord(root, record, source)).toEqual([
      "docs/record.md:1: Verdict must be one of none, constrain-existing, reshape",
    ]);
  });

  it("reports malformed canonical fields after a valid verdict", () => {
    const root = createRepo();
    const source = noneRecord()
      .replace(
        "Affected axes: Source of truth and authority; State lifetime and recovery",
        "Affected axes: Private cache magic",
      )
      .replace(
        "Existing-boundary evidence: the current route and store already enforce the invariant.",
        "Existing-boundary evidence:",
      )
      .replace("Human decision required: no", "Human decision required: probably not");
    const record = firstRecord(source);
    const errors = validateCairRecord(root, record, source);

    expect(errors).toContain(
      'docs/record.md:1: missing or empty required field "Existing-boundary evidence"',
    );
    expect(errors).toContain(
      'docs/record.md:1: unknown affected axis "Private cache magic"; use the canonical 11-axis vocabulary',
    );
    expect(errors).toContain(
      'docs/record.md:1: Human decision required must be "no" or a question ending in "?"',
    );
  });

  it("does not duplicate the Human-decision error when the field is missing", () => {
    const root = createRepo();
    const source = noneRecord().replace("Human decision required: no", "");

    expect(validateCairRecord(root, firstRecord(source), source)).toEqual([
      'docs/record.md:1: missing or empty required field "Human decision required"',
    ]);
  });

  it("requires resolvable structural defense targets", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "`scripts/quality/missing.mjs`",
    );
    const record = firstRecord(source);
    const errors = validateCairRecord(root, record, source);

    expect(errors).toContain(
      'docs/record.md:1: structural defense target "scripts/quality/missing.mjs" does not resolve',
    );
    expect(errors).toContain(
      "docs/record.md:1: Evidence and structural defense must cite at least one existing path, npm script, or Aspect ref",
    );
  });

  it("resolves an npm script cited inside Markdown inline code", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "`npm run guard:example`",
    );

    expect(validateCairRecord(root, firstRecord(source), source)).toEqual([]);
  });

  it("resolves a bold Markdown npm script citation", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "**npm run guard:example**",
    );

    expect(validateCairRecord(root, firstRecord(source), source)).toEqual([]);
  });

  it("parses npm script punctuation and Korean-adjacent prose without prototype matches", () => {
    const root = createRepo();
    for (const citation of ["npm run guard:example:", "npm run guard:example를 실행한다"]) {
      const source = constrainedRecord().replace(
        "npm run guard:example and `scripts/quality/example.mjs`",
        citation,
      );
      expect(validateCairRecord(root, firstRecord(source), source)).toEqual([]);
    }

    const prototypeCitation = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "npm run constructor",
    );
    expect(validateCairRecord(root, firstRecord(prototypeCitation), prototypeCitation)).toContain(
      'docs/record.md:1: structural defense cites missing npm script "constructor"',
    );
  });

  it("requires an exact Aspect frontmatter id rather than a prefix match", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "aspect:exam",
    );

    expect(validateCairRecord(root, firstRecord(source), source)).toContain(
      'docs/record.md:1: structural defense cites missing Aspect "aspect:exam"',
    );
  });

  it("ignores external Markdown links when a local structural defense resolves", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "npm run guard:example and [issue #449](https://github.com/jaeyoungkang/lighthouse/issues/449)",
    );

    expect(validateCairRecord(root, firstRecord(source), source)).toEqual([]);
  });

  it("ignores route and Git-ref inline code when a real structural defense resolves", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "npm run guard:example with `POST /api/route-ai-comments/generate/:viewId` on `origin/main`",
    );

    expect(validateCairRecord(root, firstRecord(source), source)).toEqual([]);
  });

  it("does not report every npm script as missing when package.json cannot be read", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "npm run guard:example",
    );
    const errors = validateCairRecord(root, firstRecord(source), source, {
      exists: () => false,
      listFiles: () => [],
      readFile: () => undefined,
    });

    expect(errors).toContain("docs/record.md:1: package.json could not be read");
    expect(errors.some((error) => error.includes('missing npm script "guard:example"'))).toBe(
      false,
    );
  });

  it("requires exactly one owner separator", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "Source of truth and authority; Observability and audit — package scripts and the quality workflow remain the current owners.",
      "Source of truth and authority — the store; Compatibility and retirement — the router",
    );

    expect(validateCairRecord(root, firstRecord(source), source)).toContain(
      'docs/record.md:1: Affected axes and current owners must contain exactly one " — " owner separator',
    );
  });

  it("rejects an owner clause on a none record", () => {
    const root = createRepo();
    const source = noneRecord().replace(
      "Affected axes: Source of truth and authority; State lifetime and recovery",
      "Affected axes: Source of truth and authority — the existing store",
    );

    expect(validateCairRecord(root, firstRecord(source), source)).toContain(
      "docs/record.md:1: Affected axes must not include an owner clause",
    );
  });

  it("reports one focused error when the owner separator is missing", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "Source of truth and authority; Observability and audit — package scripts and the quality workflow remain the current owners.",
      "Source of truth and authority",
    );

    expect(validateCairRecord(root, firstRecord(source), source)).toEqual([
      'docs/record.md:1: Affected axes and current owners must use "<Axis>; <Axis> — <current owners>"',
    ]);
  });

  it("does not load npm or Aspect indexes for a path-only structural defense", () => {
    const root = createRepo();
    const source = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "`scripts/quality/example.mjs`",
    );
    const repositoryView = {
      exists: (relativePath: string) => relativePath === "scripts/quality/example.mjs",
      listFiles: () => {
        throw new Error("Aspect index should stay lazy");
      },
      readFile: () => {
        throw new Error("package.json should stay lazy");
      },
    };

    expect(validateCairRecord(root, firstRecord(source), source, repositoryView)).toEqual([]);
  });

  it("does not append trailing prose to the final canonical field", () => {
    const root = createRepo();
    const source = `${noneRecord()}

This paragraph is outside the CAIR field list.`;

    expect(validateCairRecord(root, firstRecord(source), source)).toEqual([]);
  });

  it("does not read canonical fields from a later subheading", () => {
    const root = createRepo();
    const source = `${constrainedRecord().replace(
      "Decision: keep the existing topology and add a deterministic guard.",
      "",
    )}

### Notes

Decision: this belongs to the notes section.`;

    expect(validateCairRecord(root, firstRecord(source), source)).toContain(
      'docs/record.md:1: missing or empty required field "Decision"',
    );
  });

  it("does not read canonical fields or follow-up headings from fenced examples", () => {
    const root = createRepo();
    const missingDecision = `${constrainedRecord().replace(
      "Decision: keep the existing topology and add a deterministic guard.",
      "",
    )}

\`\`\`text
Decision: this is only an example.
\`\`\``;
    expect(validateCairRecord(root, firstRecord(missingDecision), missingDecision)).toContain(
      'docs/record.md:1: missing or empty required field "Decision"',
    );

    const reshape = `${constrainedRecord().replace(
      "Verdict: constrain-existing",
      "Verdict: reshape",
    )}

\`\`\`markdown
## Propagation Map
\`\`\``;
    expect(
      validateCairRecord(root, firstRecord(reshape), reshape).some((error) =>
        error.includes('reshape requires an exact "## Propagation Map" heading'),
      ),
    ).toBe(true);
  });

  it("requires reshape follow-ups according to the canonical trigger axes", () => {
    const root = createRepo();
    const source = constrainedRecord()
      .replace("Verdict: constrain-existing", "Verdict: reshape")
      .replace(
        "Source of truth and authority; Observability and audit",
        "Compatibility and retirement",
      );
    const record = firstRecord(source);
    const errors = validateCairRecord(root, record, source);

    expect(errors).toContain(
      'docs/record.md:1: reshape requires an exact "## Propagation Map" heading or "Propagation Map:" durable reference',
    );
    expect(errors).toContain(
      "docs/record.md:1: reshape affecting Compatibility and retirement requires a Concept Shift Architecture Review heading or durable reference",
    );

    const withFollowUps = `${source}

## Concept Shift Architecture Review

remove the retired shape.

## Propagation Map

close the owning files.`;
    expect(validateCairRecord(root, firstRecord(withFollowUps), withFollowUps)).toEqual([]);
  });

  it("scopes reshape follow-ups to their owning record", () => {
    const root = createRepo();
    const first = `${constrainedRecord().replace("Verdict: constrain-existing", "Verdict: reshape")}

## Propagation Map

The first record owns this map.`;
    const second = constrainedRecord().replace("Verdict: constrain-existing", "Verdict: reshape");
    const source = `${first}

${second}`;
    const secondRecord = parseCairRecords("docs/record.md", source)[1];
    const errors = validateCairRecord(root, secondRecord, source);

    expect(
      errors.some((error) =>
        error.includes('reshape requires an exact "## Propagation Map" heading'),
      ),
    ).toBe(true);
  });

  it("requires durable follow-up references to resolve", () => {
    const root = createRepo();
    const reshapeRecord = constrainedRecord().replace(
      "Verdict: constrain-existing",
      "Verdict: reshape",
    );
    const unresolved = `${reshapeRecord}

Propagation Map: TBD`;
    expect(
      validateCairRecord(root, firstRecord(unresolved), unresolved).some((error) =>
        error.includes('reshape requires an exact "## Propagation Map" heading'),
      ),
    ).toBe(true);

    mkdirSync(path.join(root, "docs/plans"), { recursive: true });
    writeFileSync(
      path.join(root, "docs/plans/propagation.md"),
      "## Propagation Map\n\nThe owning files remain bounded.\n",
    );
    const resolved = `${reshapeRecord}

Propagation Map: \`docs/plans/propagation.md#propagation-map\``;
    expect(validateCairRecord(root, firstRecord(resolved), resolved)).toEqual([]);
  });

  it("does not accept a distant Propagation Map after an unrelated section", () => {
    const root = createRepo();
    const reshapeRecord = constrainedRecord().replace(
      "Verdict: constrain-existing",
      "Verdict: reshape",
    );
    const source = `${reshapeRecord}

### Other section

Unrelated material.

## Propagation Map

This map belongs to the other section.`;

    expect(
      validateCairRecord(root, firstRecord(source), source).some((error) =>
        error.includes('reshape requires an exact "## Propagation Map" heading'),
      ),
    ).toBe(true);
  });
});

describe("CAIR diff cross references", () => {
  it("requires each changed Promise or Aspect to carry a record or durable link", () => {
    const root = createRepo();
    const result = validateCairChanges(root, [
      {
        path: "docs/contracts/story-chain/promises/example.md",
        source: "# Promise without a CAIR record\n",
      },
    ]);

    expect(result.errors).toEqual([
      'docs/contracts/story-chain/promises/example.md: changed Story Chain contract file requires an embedded CAIR record or a "CAIR record:" durable reference',
    ]);
  });

  it("resolves a repo-local durable CAIR link", () => {
    const root = createRepo();
    mkdirSync(path.join(root, "docs/runtime-flows"), { recursive: true });
    writeFileSync(path.join(root, "docs/runtime-flows/example.md"), noneRecord());

    const result = validateCairChanges(root, [
      {
        path: "docs/contracts/story-chain/promises/example.md",
        source:
          "- CAIR record: `docs/runtime-flows/example.md#contract-architecture-impact-review`\n",
      },
    ]);

    expect(result.errors).toEqual([]);
  });

  it("does not revalidate an unchanged legacy link target for an unrelated contract edit", () => {
    const root = createRepo();
    mkdirSync(path.join(root, "docs/runtime-flows"), { recursive: true });
    const recordPath = "docs/runtime-flows/legacy.md";
    writeFileSync(
      path.join(root, recordPath),
      `## Contract Architecture Impact Review

판정: reshape
`,
    );
    const link = `CAIR record: \`${recordPath}#contract-architecture-impact-review\``;
    const result = validateCairChanges(root, [
      {
        path: "docs/contracts/story-chain/promises/example.md",
        baselineSource: `${link}\n\nold paragraph\n`,
        source: `${link}\n\nnew paragraph\n`,
      },
    ]);

    expect(result.errors).toEqual([]);
  });

  it("validates a legacy link target when the durable link is newly introduced", () => {
    const root = createRepo();
    mkdirSync(path.join(root, "docs/runtime-flows"), { recursive: true });
    const recordPath = "docs/runtime-flows/legacy.md";
    writeFileSync(
      path.join(root, recordPath),
      `## Contract Architecture Impact Review

판정: reshape
`,
    );
    const result = validateCairChanges(root, [
      {
        path: "docs/contracts/story-chain/promises/example.md",
        baselineSource: "# Promise\n",
        source: `CAIR record: \`${recordPath}#contract-architecture-impact-review\`\n`,
      },
    ]);

    expect(result.errors).toContain(
      `${recordPath}:1: Verdict must be one of none, constrain-existing, reshape`,
    );
  });

  it("validates a newly linked legacy target even when that target is renamed", () => {
    const root = createRepo();
    mkdirSync(path.join(root, "docs/runtime-flows"), { recursive: true });
    const oldRecordPath = "docs/runtime-flows/legacy.md";
    const newRecordPath = "docs/runtime-flows/legacy-renamed.md";
    const legacyRecord = `## Contract Architecture Impact Review

판정: reshape
`;
    writeFileSync(path.join(root, newRecordPath), legacyRecord);
    const result = validateCairChanges(root, [
      {
        path: newRecordPath,
        baselinePath: oldRecordPath,
        baselineSource: legacyRecord,
        source: legacyRecord,
      },
      {
        path: "docs/contracts/story-chain/promises/example.md",
        baselineSource: "# Promise\n",
        source: `CAIR record: \`${newRecordPath}#contract-architecture-impact-review\`\n`,
      },
    ]);

    expect(result.errors).toContain(
      `${newRecordPath}:1: Verdict must be one of none, constrain-existing, reshape`,
    );
  });

  it("does not accept a fenced durable-link example as the contract link", () => {
    const root = createRepo();
    const contractPath = "docs/contracts/story-chain/promises/example.md";
    const result = validateCairChanges(root, [
      {
        path: contractPath,
        source: `# Promise

\`\`\`text
CAIR record: \`docs/example.md#contract-architecture-impact-review\`
\`\`\`
`,
      },
    ]);

    expect(result.errors).toContain(
      `${contractPath}: changed Story Chain contract file requires an embedded CAIR record or a "CAIR record:" durable reference`,
    );
  });

  it("deduplicates errors when multiple new links target the same invalid record", () => {
    const root = createRepo();
    mkdirSync(path.join(root, "docs/runtime-flows"), { recursive: true });
    const recordPath = "docs/runtime-flows/invalid.md";
    writeFileSync(
      path.join(root, recordPath),
      noneRecord().replace("Verdict: none", "Verdict: maybe"),
    );
    const source = `CAIR record: \`${recordPath}#contract-architecture-impact-review\`\n`;
    const result = validateCairChanges(root, [
      {
        path: "docs/contracts/story-chain/promises/first.md",
        baselineSource: "# First\n",
        source,
      },
      {
        path: "docs/contracts/story-chain/aspects/second.md",
        baselineSource: "# Second\n",
        source,
      },
    ]);

    expect(
      result.errors.filter(
        (error) =>
          error === `${recordPath}:1: Verdict must be one of none, constrain-existing, reshape`,
      ),
    ).toHaveLength(1);
  });

  it("requires durable links for nested Promise and Aspect paths", () => {
    const root = createRepo();
    const nestedPath = "docs/contracts/story-chain/promises/experience/example.md";
    const result = validateCairChanges(root, [{ path: nestedPath, source: "# no record\n" }]);

    expect(result.contractFileCount).toBe(1);
    expect(result.errors).toContain(
      `${nestedPath}: changed Story Chain contract file requires an embedded CAIR record or a "CAIR record:" durable reference`,
    );
  });

  it("requires a changed Experience file to carry a record or durable link", () => {
    const root = createRepo();
    const experiencePath = "docs/contracts/story-chain/experiences/example.md";
    const result = validateCairChanges(root, [
      { path: experiencePath, source: "# Experience without a CAIR record\n" },
    ]);

    expect(result.contractFileCount).toBe(1);
    expect(result.errors).toEqual([
      `${experiencePath}: changed Story Chain contract file requires an embedded CAIR record or a "CAIR record:" durable reference`,
    ]);
  });

  it("accepts a changed Moment file with a valid embedded CAIR record", () => {
    const root = createRepo();
    const momentPath = "docs/contracts/story-chain/moments/example.md";
    const result = validateCairChanges(root, [
      { path: momentPath, source: `# Moment\n\n${noneRecord()}` },
    ]);

    expect(result.contractFileCount).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("accepts a changed Moment file with a valid CAIR record durable pointer", () => {
    const root = createRepo();
    mkdirSync(path.join(root, "docs/runtime-flows"), { recursive: true });
    writeFileSync(path.join(root, "docs/runtime-flows/example.md"), noneRecord());
    const momentPath = "docs/contracts/story-chain/moments/example.md";

    const result = validateCairChanges(root, [
      {
        path: momentPath,
        source:
          "- CAIR record: `docs/runtime-flows/example.md#contract-architecture-impact-review`\n",
      },
    ]);

    expect(result.contractFileCount).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("accepts a deleted Experience file when a durable CAIR record is elsewhere in the diff", () => {
    const root = createRepo();
    const experiencePath = "docs/contracts/story-chain/experiences/retired.md";
    const deleted = {
      path: experiencePath,
      source: "",
      baselineSource: "# Retired Experience\n",
      deleted: true,
    };

    const missing = validateCairChanges(root, [deleted]);
    expect(missing.errors).toContain(
      `${experiencePath}: deleted Story Chain contract file requires a durable CAIR record in the same change`,
    );

    const recordPath = "docs/architecture-fitness/retirement.md";
    const recordSource = noneRecord();
    writeFileSync(path.join(root, recordPath), recordSource);
    const recorded = validateCairChanges(root, [
      deleted,
      { path: recordPath, source: recordSource },
    ]);
    expect(recorded.errors).not.toContain(
      `${experiencePath}: deleted Story Chain contract file requires a durable CAIR record in the same change`,
    );
  });

  it("rejects a newly introduced titled CAIR heading without rechecking a historical one", () => {
    const root = createRepo();
    const titledHeading = "### Contract Architecture Impact Review — Issue #449";
    const added = validateCairChanges(root, [
      {
        path: "docs/process.md",
        baselineSource: "# Process\n",
        source: `# Process\n\n${titledHeading}\n`,
      },
    ]);
    expect(added.errors).toContain(
      'docs/process.md:3: CAIR heading must be exactly "## Contract Architecture Impact Review"',
    );

    const historical = validateCairChanges(root, [
      {
        path: "docs/process.md",
        baselineSource: `${titledHeading}\n\nold paragraph\n`,
        source: `${titledHeading}\n\nnew paragraph\n`,
      },
    ]);
    expect(historical.errors).toEqual([]);
  });

  it("ignores CAIR headings and near-miss examples inside Markdown fences", () => {
    const root = createRepo();
    const source = `# Example

\`\`\`markdown
## Contract Architecture Impact Review

Contract delta:

### Contract Architecture Impact Review — near miss
\`\`\`
`;
    const result = validateCairChanges(root, [
      { path: "docs/example.md", baselineSource: "# Example\n", source },
    ]);

    expect(result.recordCount).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("accepts a repository-scoped GitHub issue or PR as a durable external link", () => {
    const root = createRepo();
    const result = validateCairChanges(root, [
      {
        path: "docs/contracts/story-chain/aspects/external.md",
        source:
          "CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/497#issuecomment-1\n",
      },
    ]);

    expect(result.errors).toEqual([]);
  });

  it("keeps architectureImpact declared and its linked CAIR verdict aligned", () => {
    const root = createRepo();
    const recordPath = "docs/architecture-fitness/record.md";
    writeFileSync(path.join(root, recordPath), constrainedRecord());
    const declarationPath = "docs/architecture-fitness/example.change.json";
    const declaration = JSON.stringify({
      architectureImpact: "declared",
      cairVerdict: "reshape",
      recordRef: `${recordPath}#contract-architecture-impact-review`,
    });
    writeFileSync(path.join(root, declarationPath), declaration);

    const result = validateCairChanges(root, [{ path: declarationPath, source: declaration }]);

    expect(result.errors).toContain(
      `${declarationPath}: cairVerdict "reshape" does not match linked record verdict "constrain-existing"`,
    );
  });

  it("validates none and unknown Architecture Fitness declarations", () => {
    const root = createRepo();
    const cases = [
      {
        name: "none-verdict",
        declaration: { architectureImpact: "none", cairVerdict: "reshape" },
        error: 'architectureImpact "none" requires cairVerdict "none"',
      },
      {
        name: "none-ref",
        declaration: {
          architectureImpact: "none",
          cairVerdict: "none",
          recordRef: "docs/architecture-fitness/record.md#contract-architecture-impact-review",
        },
        error: 'architectureImpact "none" must not set recordRef',
      },
      {
        name: "unknown-impact",
        declaration: { architectureImpact: "maybe", cairVerdict: "none" },
        error: 'architectureImpact must be "none" or "declared"',
      },
    ];

    const changedFiles = cases.map(({ name, declaration }) => {
      const declarationPath = `docs/architecture-fitness/${name}.change.json`;
      const source = JSON.stringify(declaration);
      writeFileSync(path.join(root, declarationPath), source);
      return { path: declarationPath, source };
    });
    const result = validateCairChanges(root, changedFiles);

    for (const { name, error } of cases) {
      expect(result.errors).toContain(`docs/architecture-fitness/${name}.change.json: ${error}`);
    }
  });

  it("rejects invalid Architecture Fitness declaration JSON", () => {
    const root = createRepo();
    const declarationPath = "docs/architecture-fitness/invalid.change.json";
    writeFileSync(path.join(root, declarationPath), "{ not-json");

    const result = validateCairChanges(root, [{ path: declarationPath, source: "{ not-json" }]);

    expect(
      result.errors.some((error) =>
        error.startsWith(`${declarationPath}: invalid architecture impact declaration JSON:`),
      ),
    ).toBe(true);
  });

  it("rejects a linked CAIR record without a readable verdict", () => {
    const root = createRepo();
    const recordPath = "docs/architecture-fitness/record.md";
    writeFileSync(
      path.join(root, recordPath),
      "## Contract Architecture Impact Review\n\nHistorical prose without a verdict.\n",
    );
    const declarationPath = "docs/architecture-fitness/unreadable.change.json";
    const source = JSON.stringify({
      architectureImpact: "declared",
      cairVerdict: "none",
      recordRef: `${recordPath}#contract-architecture-impact-review`,
    });
    writeFileSync(path.join(root, declarationPath), source);

    const result = validateCairChanges(root, [{ path: declarationPath, source }]);

    expect(result.errors).toContain(
      `${declarationPath}: linked CAIR record verdict could not be determined`,
    );
  });

  it("rechecks an unchanged record when its cited defense path is deleted", () => {
    const root = createRepo();
    const recordPath = "docs/architecture-fitness/record.md";
    writeFileSync(path.join(root, recordPath), constrainedRecord());
    const defensePath = "scripts/quality/example.mjs";
    unlinkSync(path.join(root, defensePath));

    const result = validateCairChanges(root, [
      {
        path: defensePath,
        source: "",
        baselineSource: "export {};\n",
        deleted: true,
      },
    ]);

    expect(result.errors).toContain(
      `${recordPath}:1: structural defense target "${defensePath}" does not resolve`,
    );
  });

  it("rechecks an unchanged record when its cited defense path is renamed", () => {
    const root = createRepo();
    const recordPath = "docs/architecture-fitness/record.md";
    writeFileSync(path.join(root, recordPath), constrainedRecord());
    const oldPath = "scripts/quality/example.mjs";
    const newPath = "scripts/quality/renamed.mjs";
    renameSync(path.join(root, oldPath), path.join(root, newPath));

    const result = validateCairChanges(root, [
      {
        path: newPath,
        baselinePath: oldPath,
        source: "export {};\n",
        baselineSource: "export {};\n",
      },
    ]);

    expect(result.errors).toContain(
      `${recordPath}:1: structural defense target "${oldPath}" does not resolve`,
    );
  });

  it("rechecks an unchanged record when its cited npm script is removed", () => {
    const root = createRepo();
    const recordPath = "docs/architecture-fitness/record.md";
    writeFileSync(path.join(root, recordPath), constrainedRecord());
    const packagePath = path.join(root, "package.json");
    const baselineSource = readFileSync(packagePath, "utf8");
    const source = JSON.stringify({ scripts: {} });
    writeFileSync(packagePath, source);

    const result = validateCairChanges(root, [{ path: "package.json", source, baselineSource }]);

    expect(result.errors).toContain(
      `${recordPath}:1: structural defense cites missing npm script "guard:example"`,
    );
  });

  it("rechecks an unchanged Promise link when its CAIR record is deleted", () => {
    const root = createRepo();
    const recordPath = "docs/architecture-fitness/record.md";
    const contractPath = "docs/contracts/story-chain/promises/linked.md";
    const recordSource = noneRecord();
    writeFileSync(path.join(root, recordPath), recordSource);
    writeFileSync(
      path.join(root, contractPath),
      `CAIR record: \`${recordPath}#contract-architecture-impact-review\`\n`,
    );
    unlinkSync(path.join(root, recordPath));

    const result = validateCairChanges(root, [
      {
        path: recordPath,
        source: "",
        baselineSource: recordSource,
        deleted: true,
      },
    ]);

    expect(result.errors).toContain(
      `${contractPath}: CAIR record ref "${recordPath}#contract-architecture-impact-review" must resolve to one exact CAIR record`,
    );
  });

  it("rechecks an unchanged reshape record when its follow-up target is deleted", () => {
    const root = createRepo();
    const followUpPath = "docs/architecture-fitness/propagation.md";
    const recordPath = "docs/architecture-fitness/record.md";
    const followUpSource = "## Propagation Map\n\nOwning edits remain bounded.\n";
    writeFileSync(path.join(root, followUpPath), followUpSource);
    writeFileSync(
      path.join(root, recordPath),
      `${constrainedRecord().replace("Verdict: constrain-existing", "Verdict: reshape")}
Propagation Map: \`${followUpPath}#propagation-map\`
`,
    );
    unlinkSync(path.join(root, followUpPath));

    const result = validateCairChanges(root, [
      {
        path: followUpPath,
        source: "",
        baselineSource: followUpSource,
        deleted: true,
      },
    ]);

    expect(result.errors).toContain(
      `${recordPath}:1: reshape requires an exact "## Propagation Map" heading or "Propagation Map:" durable reference`,
    );
  });

  it("rechecks an unchanged reshape record when its follow-up heading is removed", () => {
    const root = createRepo();
    const followUpPath = "docs/architecture-fitness/propagation.md";
    const recordPath = "docs/architecture-fitness/record.md";
    const baselineSource = "## Propagation Map\n\nOwning edits remain bounded.\n";
    const source = "# Plan without the required heading\n";
    writeFileSync(path.join(root, followUpPath), source);
    writeFileSync(
      path.join(root, recordPath),
      `${constrainedRecord().replace("Verdict: constrain-existing", "Verdict: reshape")}
Propagation Map: \`${followUpPath}#propagation-map\`
`,
    );

    const result = validateCairChanges(root, [{ path: followUpPath, source, baselineSource }]);

    expect(result.errors).toContain(
      `${recordPath}:1: reshape requires an exact "## Propagation Map" heading or "Propagation Map:" durable reference`,
    );
  });

  it("rechecks an unchanged record when a cited Aspect id changes", () => {
    const root = createRepo();
    const recordPath = "docs/architecture-fitness/record.md";
    writeFileSync(
      path.join(root, recordPath),
      constrainedRecord().replace(
        "npm run guard:example and `scripts/quality/example.mjs`",
        "aspect:example",
      ),
    );
    const aspectPath = "docs/contracts/story-chain/aspects/example.md";
    const baselineSource = readFileSync(path.join(root, aspectPath), "utf8");
    const source = baselineSource.replace("aspect:example", "aspect:example-v2");
    writeFileSync(path.join(root, aspectPath), source);

    const result = validateCairChanges(root, [{ path: aspectPath, source, baselineSource }]);

    expect(result.errors).toContain(
      `${recordPath}:1: structural defense cites missing Aspect "aspect:example"`,
    );
  });

  it("requires a durable CAIR record when a Promise or Aspect is deleted", () => {
    const root = createRepo();
    const contractPath = "docs/contracts/story-chain/promises/retired.md";
    const deleted = {
      path: contractPath,
      source: "",
      baselineSource: "# Retired Promise\n",
      deleted: true,
    };

    const missing = validateCairChanges(root, [deleted]);
    expect(missing.errors).toContain(
      `${contractPath}: deleted Story Chain contract file requires a durable CAIR record in the same change`,
    );

    const recordPath = "docs/architecture-fitness/retirement.md";
    const recordSource = noneRecord();
    writeFileSync(path.join(root, recordPath), recordSource);
    const recorded = validateCairChanges(root, [
      deleted,
      { path: recordPath, source: recordSource },
    ]);
    expect(recorded.errors).not.toContain(
      `${contractPath}: deleted Story Chain contract file requires a durable CAIR record in the same change`,
    );

    const unchanged = validateCairChanges(root, [
      deleted,
      { path: recordPath, source: recordSource, baselineSource: recordSource },
    ]);
    expect(unchanged.errors).toContain(
      `${contractPath}: deleted Story Chain contract file requires a durable CAIR record in the same change`,
    );

    const removedSource = "# Historical plan without its retired CAIR record\n";
    writeFileSync(path.join(root, recordPath), removedSource);
    const removed = validateCairChanges(root, [
      deleted,
      {
        path: recordPath,
        source: removedSource,
        baselineSource: recordSource,
      },
    ]);
    expect(removed.errors).toContain(
      `${contractPath}: deleted Story Chain contract file requires a durable CAIR record in the same change`,
    );
  });

  it("rechecks relative references when a CAIR record file is renamed", () => {
    const root = createRepo();
    const oldDirectory = "docs/architecture-fitness/old";
    const newDirectory = "docs/architecture-fitness/new";
    mkdirSync(path.join(root, oldDirectory), { recursive: true });
    mkdirSync(path.join(root, newDirectory), { recursive: true });
    const oldPath = `${oldDirectory}/record.md`;
    const newPath = `${newDirectory}/record.md`;
    const source = constrainedRecord().replace(
      "npm run guard:example and `scripts/quality/example.mjs`",
      "`./guard.mjs`",
    );
    writeFileSync(path.join(root, oldPath), source);
    writeFileSync(path.join(root, oldDirectory, "guard.mjs"), "export {};\n");
    renameSync(path.join(root, oldPath), path.join(root, newPath));

    const result = validateCairChanges(root, [
      { path: newPath, baselinePath: oldPath, source, baselineSource: source },
    ]);

    expect(result.errors).toContain(
      `${newPath}:1: structural defense target "./guard.mjs" does not resolve`,
    );
  });

  it("rechecks invalidated records stored under shared-skills", () => {
    const root = createRepo();
    const recordPath = "shared-skills/example/record.md";
    mkdirSync(path.dirname(path.join(root, recordPath)), { recursive: true });
    writeFileSync(path.join(root, recordPath), constrainedRecord());
    const defensePath = "scripts/quality/example.mjs";
    unlinkSync(path.join(root, defensePath));

    const result = validateCairChanges(root, [
      {
        path: defensePath,
        source: "",
        baselineSource: "export {};\n",
        deleted: true,
      },
    ]);

    expect(result.errors).toContain(
      `${recordPath}:1: structural defense target "${defensePath}" does not resolve`,
    );
  });

  it("reads legacy linked verdict forms without revalidating unchanged record syntax", () => {
    const root = createRepo();
    const legacyRecords = [
      {
        path: "docs/architecture-fitness/legacy-list.md",
        source: `## Contract Architecture Impact Review

- Verdict: \`constrain-existing\`.
`,
      },
      {
        path: "docs/architecture-fitness/legacy-prose.md",
        source: `## Contract Architecture Impact Review

이번 CAIR verdict는 \`constrain-existing\`이다.
`,
      },
    ];
    const changedDeclarations = legacyRecords.map((record, index) => {
      writeFileSync(path.join(root, record.path), record.source);
      const declarationPath = `docs/architecture-fitness/legacy-${String(index)}.change.json`;
      const declaration = JSON.stringify({
        architectureImpact: "declared",
        cairVerdict: "constrain-existing",
        recordRef: `${record.path}#contract-architecture-impact-review`,
      });
      writeFileSync(path.join(root, declarationPath), declaration);
      return { path: declarationPath, source: declaration };
    });

    const result = validateCairChanges(root, changedDeclarations);

    expect(result.declarationCount).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it("rechecks an unchanged declaration when its linked CAIR record changes", () => {
    const root = createRepo();
    const recordPath = "docs/architecture-fitness/record.md";
    const baselineSource = constrainedRecord();
    const currentSource = `${baselineSource.replace(
      "Verdict: constrain-existing",
      "Verdict: reshape",
    )}

## Propagation Map

The owning files remain bounded.`;
    writeFileSync(path.join(root, recordPath), currentSource);
    const declarationPath = "docs/architecture-fitness/example.change.json";
    writeFileSync(
      path.join(root, declarationPath),
      JSON.stringify({
        architectureImpact: "declared",
        cairVerdict: "constrain-existing",
        recordRef: `${recordPath}#contract-architecture-impact-review`,
      }),
    );

    const result = validateCairChanges(root, [
      { path: recordPath, baselineSource, source: currentSource },
    ]);

    expect(result.declarationCount).toBe(1);
    expect(result.errors).toContain(
      `${declarationPath}: cairVerdict "constrain-existing" does not match linked record verdict "reshape"`,
    );
  });

  it("rechecks an unchanged reshape record when its Propagation Map is removed", () => {
    const root = createRepo();
    const reshapeRecord = constrainedRecord().replace(
      "Verdict: constrain-existing",
      "Verdict: reshape",
    );
    const baselineSource = `${reshapeRecord}

## Propagation Map

The owning files remain bounded.`;
    const currentSource = reshapeRecord;

    const result = validateCairChanges(root, [
      { path: "docs/architecture-fitness/record.md", baselineSource, source: currentSource },
    ]);

    expect(result.recordCount).toBe(1);
    expect(
      result.errors.some((error) =>
        error.includes('reshape requires an exact "## Propagation Map" heading'),
      ),
    ).toBe(true);
  });

  it("discovers nested Architecture Fitness declarations in the filesystem view", () => {
    const root = createRepo();
    const recordPath = "docs/architecture-fitness/record.md";
    const declarationPath = "docs/architecture-fitness/pilots/example.change.json";
    mkdirSync(path.dirname(path.join(root, declarationPath)), { recursive: true });
    writeFileSync(path.join(root, recordPath), constrainedRecord());
    const declaration = JSON.stringify({
      architectureImpact: "declared",
      cairVerdict: "reshape",
      recordRef: `${recordPath}#contract-architecture-impact-review`,
    });
    writeFileSync(path.join(root, declarationPath), declaration);

    const result = validateCairChanges(root, [{ path: declarationPath, source: declaration }]);

    expect(result.declarationCount).toBe(1);
    expect(result.errors).toContain(
      `${declarationPath}: cairVerdict "reshape" does not match linked record verdict "constrain-existing"`,
    );
  });
});

describe("mc:validate-cair CLI", () => {
  it("detects its TypeScript entrypoint", () => {
    expect(
      shouldRunValidateCairCli(["node", "C:\\repo\\scripts\\mission-control\\mc-validate-cair.ts"]),
    ).toBe(true);
    expect(shouldRunValidateCairCli(["node", "/repo/node_modules/vitest/vitest.mjs"])).toBe(false);
  });

  it("reads the staged index rather than unstaged working-tree content", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    const contractPath = "docs/contracts/story-chain/promises/example.md";
    writeFileSync(path.join(root, contractPath), "# baseline\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });

    const stagedSource = noneRecord();
    writeFileSync(path.join(root, contractPath), stagedSource);
    execFileSync("git", ["add", contractPath], { cwd: root });
    writeFileSync(path.join(root, contractPath), "# unstaged content without record\n");

    const changed = collectChangedFiles(root, true);
    expect(changed).toEqual([
      {
        path: contractPath,
        source: stagedSource,
        baselineSource: "# baseline\n",
        deleted: false,
      },
    ]);
    expect(readFileSync(path.join(root, contractPath), "utf8")).not.toBe(stagedSource);
  });

  it("includes untracked files in default change validation", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });

    const contractPath = "docs/contracts/story-chain/promises/untracked.md";
    const source = noneRecord();
    writeFileSync(path.join(root, contractPath), source);

    expect(collectChangedFiles(root, false, null, false)).toContainEqual({
      path: contractPath,
      source,
      baselineSource: undefined,
      deleted: false,
    });
  });

  it("treats a working-tree restoration after a staged deletion as present", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    const contractPath = "docs/contracts/story-chain/promises/restored.md";
    writeFileSync(path.join(root, contractPath), noneRecord());
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });

    execFileSync("git", ["rm", contractPath], { cwd: root });
    mkdirSync(path.dirname(path.join(root, contractPath)), { recursive: true });
    writeFileSync(path.join(root, contractPath), "# restored without a record\n");
    const changed = collectChangedFiles(root, false, null, false);
    const restored = changed.find((file) => file.path === contractPath);

    expect(restored?.deleted).toBe(false);
    expect(validateCairChanges(root, changed).errors).toContain(
      `${contractPath}: changed Story Chain contract file requires an embedded CAIR record or a "CAIR record:" durable reference`,
    );
  });

  it("collects non-ASCII contract paths without Git quoting", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    const contractPath = "docs/contracts/story-chain/promises/검색-약속.md";
    writeFileSync(path.join(root, contractPath), "# baseline\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });

    const source = noneRecord();
    writeFileSync(path.join(root, contractPath), source);
    execFileSync("git", ["add", contractPath], { cwd: root });

    expect(collectChangedFiles(root, true)).toContainEqual({
      path: contractPath,
      source,
      baselineSource: "# baseline\n",
      deleted: false,
    });
  });

  it("falls back cleanly when origin/main has disjoint history", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "main history"], { cwd: root });
    execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], { cwd: root });
    execFileSync("git", ["checkout", "--orphan", "disjoint"], { cwd: root });
    execFileSync("git", ["commit", "--allow-empty", "-m", "disjoint history"], { cwd: root });

    expect(() => collectChangedFiles(root, false, null, false)).not.toThrow();
  });

  it("fails closed when a GitHub PR comparison base is unavailable", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "main history"], { cwd: root });
    expect(() => collectChangedFiles(root, false, "missing-base")).toThrow(
      'required PR comparison base "origin/missing-base" is unavailable',
    );
  });

  it("fails closed in CI when no comparison history is available", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "shallow history"], { cwd: root });

    expect(() => collectChangedFiles(root, false, null, true)).toThrow(
      "CI comparison base origin/main is unavailable",
    );
  });

  it("fails closed in CI when origin/main is missing despite parent history", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "first"], { cwd: root });
    execFileSync("git", ["commit", "--allow-empty", "-m", "second"], { cwd: root });

    expect(() => collectChangedFiles(root, false, null, true, null)).toThrow(
      "CI comparison base origin/main is unavailable",
    );
  });

  it("fails closed when the GitHub PR base has disjoint history", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "main history"], { cwd: root });
    execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], { cwd: root });
    execFileSync("git", ["checkout", "--orphan", "disjoint"], { cwd: root });
    execFileSync("git", ["commit", "--allow-empty", "-m", "disjoint history"], { cwd: root });

    expect(() => collectChangedFiles(root, false, "main")).toThrow(
      'required PR comparison base "origin/main" has no merge base with HEAD',
    );
  });

  it("uses HEAD^ when origin/main points at the CI push head", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    const contractPath = "docs/contracts/story-chain/promises/push.md";
    writeFileSync(path.join(root, contractPath), "# baseline\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });
    const source = noneRecord();
    writeFileSync(path.join(root, contractPath), source);
    execFileSync("git", ["add", contractPath], { cwd: root });
    execFileSync("git", ["commit", "-m", "push head"], { cwd: root });
    execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], { cwd: root });

    expect(collectChangedFiles(root, false, null, true)).toContainEqual({
      path: contractPath,
      source,
      baselineSource: "# baseline\n",
      deleted: false,
    });
  });

  it("uses the explicit CI push base across multiple commits", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    const contractPath = "docs/contracts/story-chain/promises/push-range.md";
    writeFileSync(path.join(root, contractPath), "# baseline\n");
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });
    const pushBase = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    writeFileSync(path.join(root, contractPath), "# interim\n");
    execFileSync("git", ["add", contractPath], { cwd: root });
    execFileSync("git", ["commit", "-m", "interim"], { cwd: root });
    const source = noneRecord();
    writeFileSync(path.join(root, contractPath), source);
    execFileSync("git", ["add", contractPath], { cwd: root });
    execFileSync("git", ["commit", "-m", "push head"], { cwd: root });
    execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], { cwd: root });

    expect(collectChangedFiles(root, false, null, true, pushBase)).toContainEqual({
      path: contractPath,
      source,
      baselineSource: "# baseline\n",
      deleted: false,
    });
  });

  it("resolves staged links from the index instead of the working tree", () => {
    const root = createRepo();
    mkdirSync(path.join(root, "docs/runtime-flows"), { recursive: true });
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    const contractPath = "docs/contracts/story-chain/promises/example.md";
    const recordPath = "docs/runtime-flows/example.md";
    writeFileSync(path.join(root, contractPath), "# baseline\n");
    writeFileSync(path.join(root, recordPath), noneRecord());
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });

    writeFileSync(
      path.join(root, contractPath),
      `CAIR record: \`${recordPath}#contract-architecture-impact-review\`\n`,
    );
    writeFileSync(
      path.join(root, recordPath),
      noneRecord().replace("Verdict: none", "Verdict: maybe"),
    );
    execFileSync("git", ["add", contractPath, recordPath], { cwd: root });
    writeFileSync(path.join(root, recordPath), noneRecord());

    const result = validateCairChanges(
      root,
      collectChangedFiles(root, true),
      createRepositoryView(root, true),
    );

    expect(result.errors).toContain(
      `${recordPath}:1: Verdict must be one of none, constrain-existing, reshape`,
    );
    expect(
      result.errors.filter(
        (error) =>
          error === `${recordPath}:1: Verdict must be one of none, constrain-existing, reshape`,
      ),
    ).toHaveLength(1);
  });

  it("rechecks declarations when their linked CAIR record is deleted", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    const recordPath = "docs/architecture-fitness/record.md";
    const declarationPath = "docs/architecture-fitness/pilots/example.change.json";
    mkdirSync(path.dirname(path.join(root, declarationPath)), { recursive: true });
    writeFileSync(path.join(root, recordPath), constrainedRecord());
    writeFileSync(
      path.join(root, declarationPath),
      JSON.stringify({
        architectureImpact: "declared",
        cairVerdict: "constrain-existing",
        recordRef: `${recordPath}#contract-architecture-impact-review`,
      }),
    );
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });

    execFileSync("git", ["rm", recordPath], { cwd: root });
    const result = validateCairChanges(
      root,
      collectChangedFiles(root, true),
      createRepositoryView(root, true),
    );

    expect(result.declarationCount).toBe(1);
    expect(result.errors).toContain(
      `${declarationPath}: recordRef "${recordPath}#contract-architecture-impact-review" must resolve to one exact CAIR record`,
    );
  });

  it("rechecks declarations when their linked CAIR record is renamed", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    const oldRecordPath = "docs/architecture-fitness/record.md";
    const newRecordPath = "docs/architecture-fitness/renamed-record.md";
    const declarationPath = "docs/architecture-fitness/example.change.json";
    writeFileSync(path.join(root, oldRecordPath), constrainedRecord());
    writeFileSync(
      path.join(root, declarationPath),
      JSON.stringify({
        architectureImpact: "declared",
        cairVerdict: "constrain-existing",
        recordRef: `${oldRecordPath}#contract-architecture-impact-review`,
      }),
    );
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });

    execFileSync("git", ["mv", oldRecordPath, newRecordPath], { cwd: root });
    const result = validateCairChanges(
      root,
      collectChangedFiles(root, true),
      createRepositoryView(root, true),
    );

    expect(result.declarationCount).toBe(1);
    expect(result.errors).toContain(
      `${declarationPath}: recordRef "${oldRecordPath}#contract-architecture-impact-review" must resolve to one exact CAIR record`,
    );
  });

  it("does not revalidate an unchanged historical record after a pure rename", () => {
    const root = createRepo();
    execFileSync("git", ["init"], { cwd: root });
    execFileSync("git", ["config", "user.email", "cair@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "CAIR Test"], { cwd: root });
    const oldPath = "docs/old-process.md";
    const newPath = "docs/new-process.md";
    const historicalRecord = `## Contract Architecture Impact Review

이번 기록은 현재 형식 도입 전의 역사 기록이다.
판정: reshape
`;
    writeFileSync(path.join(root, oldPath), historicalRecord);
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "baseline"], { cwd: root });

    execFileSync("git", ["mv", oldPath, newPath], { cwd: root });
    const changed = collectChangedFiles(root, true);
    const result = validateCairChanges(root, changed, createRepositoryView(root, true));

    expect(changed).toEqual([
      {
        path: newPath,
        source: historicalRecord,
        baselineSource: historicalRecord,
        baselinePath: oldPath,
        deleted: false,
      },
    ]);
    expect(result.recordCount).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("does not revalidate an untouched historical record when another paragraph changes", () => {
    const root = createRepo();
    const historicalRecord = `## Contract Architecture Impact Review

이번 기록은 현재 형식 도입 전의 역사 기록이다.
판정: reshape
`;
    const result = validateCairChanges(root, [
      {
        path: "docs/process.md",
        baselineSource: `${historicalRecord}\n## Other\n\nold paragraph\n`,
        source: `${historicalRecord}\n## Other\n\nnew paragraph\n`,
      },
    ]);

    expect(result.recordCount).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("prints deterministic failures and success counts", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const root = createRepo();

    const failed = await runValidateCairCli({
      repoRoot: root,
      argv: ["node", "mc-validate-cair.ts", "--staged"],
      stdout: { write: (value: string) => (stdout.push(value), true) },
      stderr: { write: (value: string) => (stderr.push(value), true) },
      collectChangedFiles: () => [
        {
          path: "docs/contracts/story-chain/aspects/missing.md",
          source: "# no record\n",
        },
      ],
      createRepositoryView: () => undefined,
      validateCairChanges,
    });
    expect(failed).toBe(1);
    expect(stderr.join("")).toContain("mc:validate-cair — FAIL");

    stdout.length = 0;
    stderr.length = 0;
    const passed = await runValidateCairCli({
      repoRoot: root,
      argv: ["node", "mc-validate-cair.ts"],
      stdout: { write: (value: string) => (stdout.push(value), true) },
      stderr: { write: (value: string) => (stderr.push(value), true) },
      collectChangedFiles: () => [],
      createRepositoryView: () => undefined,
      validateCairChanges,
    });
    expect(passed).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain("changed CAIR records green");
  });
});

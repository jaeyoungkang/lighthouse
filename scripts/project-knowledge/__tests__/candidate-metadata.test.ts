import { describe, expect, it } from "vitest";

import { validateSharedCandidateMetadata } from "../candidate-metadata";

function candidate(frontmatter: string): string {
  return `---\n${frontmatter}\n---\n\n# Narrative: process memory\n`;
}

describe("shared Project Knowledge candidate metadata", () => {
  it("accepts a promotion-reviewed process lane with owning authority refs", () => {
    expect(
      validateSharedCandidateMetadata(
        candidate(`status: candidate
knowledge_lane: process
authority_refs:
  - docs/agent-skills.md
  - shared-skills/skill-governance-steward/SKILL.md
source_refs:
  - commit: 60a9d7781ded06374b15212d01b6a609a9811424`),
      ),
    ).toEqual({
      knowledgeLane: "process",
      authorityRefs: ["docs/agent-skills.md", "shared-skills/skill-governance-steward/SKILL.md"],
    });
  });

  it("accepts a project lane with an anchored repository authority ref", () => {
    expect(
      validateSharedCandidateMetadata(
        candidate(`status: candidate
knowledge_lane: project
authority_refs:
  - docs/project-knowledge/README.md#흐름`),
      ),
    ).toEqual({
      knowledgeLane: "project",
      authorityRefs: ["docs/project-knowledge/README.md#흐름"],
    });
  });

  it("rejects a candidate whose lane was not assigned during promotion review", () => {
    expect(() =>
      validateSharedCandidateMetadata(
        candidate(`status: candidate
knowledge_lane: pending
authority_refs:
  - docs/project-knowledge/README.md`),
      ),
    ).toThrow("knowledge_lane must be 'project' or 'process'");
  });

  it("rejects a shared candidate without an owning authority ref", () => {
    expect(() =>
      validateSharedCandidateMetadata(
        candidate(`status: candidate
knowledge_lane: process
authority_refs:
  -
source_refs:
  - commit: 60a9d7781ded06374b15212d01b6a609a9811424`),
      ),
    ).toThrow("authority_refs must be non-empty strings");
  });

  it("rejects non-existent and non-string authority refs", () => {
    expect(() =>
      validateSharedCandidateMetadata(
        candidate(`status: candidate
knowledge_lane: process
authority_refs:
  - definitely-not-an-owner
source_refs:
  - commit: 60a9d7781ded06374b15212d01b6a609a9811424`),
      ),
    ).toThrow("must resolve to a repository file");

    expect(() =>
      validateSharedCandidateMetadata(
        candidate(`status: candidate
knowledge_lane: process
authority_refs:
  - docs/agent-skills.md
  - 42
source_refs:
  - commit: 60a9d7781ded06374b15212d01b6a609a9811424`),
      ),
    ).toThrow("authority_refs must be non-empty strings");
  });

  it("rejects a process candidate without an evidence commit source ref", () => {
    expect(() =>
      validateSharedCandidateMetadata(
        candidate(`status: candidate
knowledge_lane: process
authority_refs:
  - docs/agent-skills.md
source_refs:
  - file: docs/agent-skills.md`),
      ),
    ).toThrow("source_refs must include an evidence commit SHA");
  });

  it("accepts an unquoted all-digit short SHA without losing its YAML lexeme", () => {
    expect(
      validateSharedCandidateMetadata(
        candidate(`status: candidate
knowledge_lane: process
authority_refs:
  - docs/agent-skills.md
source_refs:
  - commit: 4105759`),
      ),
    ).toEqual({
      knowledgeLane: "process",
      authorityRefs: ["docs/agent-skills.md"],
    });
  });
});

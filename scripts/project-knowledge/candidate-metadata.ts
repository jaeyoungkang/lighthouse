import { REPO_ROOT } from "./common";
import {
  parseSharedCandidateMetadata,
  validateSharedAuthorityRef,
} from "./shared-memory-entry.mjs";

export type KnowledgeLane = "project" | "process";

export type SharedCandidateMetadata = {
  knowledgeLane: KnowledgeLane;
  authorityRefs: string[];
};

function validateAuthorityRef(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Shared Project Knowledge candidate authority_refs must be non-empty strings.");
  }
  const authorityRef = value.trim();
  if (!validateSharedAuthorityRef(authorityRef, REPO_ROOT)) {
    throw new Error(
      `Shared Project Knowledge candidate authority_ref must resolve to a repository file: ${authorityRef}`,
    );
  }
  return authorityRef;
}

export function validateSharedCandidateMetadata(markdown: string): SharedCandidateMetadata {
  const parsedMetadata: unknown = parseSharedCandidateMetadata(markdown);
  if (
    !parsedMetadata ||
    typeof parsedMetadata !== "object" ||
    !("knowledgeLane" in parsedMetadata) ||
    !("authorityRefs" in parsedMetadata) ||
    (parsedMetadata.knowledgeLane !== "project" && parsedMetadata.knowledgeLane !== "process") ||
    !Array.isArray(parsedMetadata.authorityRefs)
  ) {
    throw new Error("Shared Project Knowledge candidate metadata parser returned invalid data.");
  }
  const knowledgeLane = parsedMetadata.knowledgeLane;
  const authorityRefs = parsedMetadata.authorityRefs.map(validateAuthorityRef);

  return { knowledgeLane, authorityRefs };
}

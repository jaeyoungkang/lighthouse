import { createHash } from "node:crypto";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";
import {
  hasUsableInlineAnalysisAbstract,
  normalizeInlineAnalysisInputText,
} from "@/app/lib/inline-analysis";
import type { PaperInput } from "@/app/server/services/inline-analysis-service";

interface InlineAnalysisCacheIdentityValue {
  paperId: string;
  version: number;
  inputFingerprint: string;
}

function toCanonicalInlineAnalysisInput(paper: PaperInput): PaperInput {
  return {
    ...paper,
    title: normalizeInlineAnalysisInputText(paper.title),
    abstract: normalizeInlineAnalysisInputText(paper.abstract),
    year: paper.year ?? null,
  };
}

export function buildInlineAnalysisInputFingerprint(
  paper: Pick<PaperInput, "title" | "abstract" | "year">,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: normalizeInlineAnalysisInputText(paper.title),
        abstract: normalizeInlineAnalysisInputText(paper.abstract),
        year: paper.year ?? null,
      }),
    )
    .digest("hex");
}

export function buildInlineAnalysisRequestKey(
  identities: InlineAnalysisCacheIdentityValue[],
): string {
  return JSON.stringify(
    [...identities]
      .sort((left, right) => {
        if (left.paperId !== right.paperId) return left.paperId < right.paperId ? -1 : 1;
        if (left.version !== right.version) return left.version - right.version;
        if (left.inputFingerprint === right.inputFingerprint) return 0;
        return left.inputFingerprint < right.inputFingerprint ? -1 : 1;
      })
      .map((identity) => [identity.paperId, identity.version, identity.inputFingerprint] as const),
  );
}

export function buildInlineAnalysisCacheIdentities(
  papers: Array<Pick<PaperInput, "paperId" | "title" | "abstract" | "year">>,
): InlineAnalysisCacheIdentityValue[] {
  return papers.map((paper) => ({
    paperId: paper.paperId,
    version: INLINE_ANALYSIS_VERSION,
    inputFingerprint: buildInlineAnalysisInputFingerprint(paper),
  }));
}

export function getCanonicalAnalyzablePapers(papers: PaperInput[]): PaperInput[] {
  return [
    ...new Map(
      papers
        .filter((paper): paper is PaperInput & { abstract: string } =>
          hasUsableInlineAnalysisAbstract(paper.abstract),
        )
        .map((paper) => [paper.paperId, paper] as const),
    ).values(),
  ].map(toCanonicalInlineAnalysisInput);
}

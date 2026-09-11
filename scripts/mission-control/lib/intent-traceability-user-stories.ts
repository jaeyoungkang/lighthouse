// Snapshot UI types are synthesised from Story Chain (see
// `intent-traceability-snapshot-source.ts`); this module is now pure type
// declarations, kept under the original filename so existing imports
// across `intent-traceability-*` modules and `aspect-verdict.ts`
// continue to resolve without churn.

export interface UsDeclaration {
  promiseRef: string;
  title: string;
  experienceScope: "core-product" | "support-layer" | "governance";
  intent: string;
  criticalQuestions: string[];
  ciqBlocks: ParsedCiqBlock[];
  // True when current Evidence Ledger coverage marks this Promise as
  // intent-absorbed into deterministic Acceptance Checks.
  absorbedIntoAc: boolean;
  // Acceptance criteria parsed from the Promise's Acceptance Check blocks.
  // Each entry is the criterion description text. Empty when the promise has
  // no Acceptance Checks.
  acceptanceCriteria: string[];
}

export interface ParsedCiqBlock {
  ciqId: string;
  question: string;
  evidencePath?: string;
  whyLiveJudge?: string;
  linkedAcs: string[];
  answerCriteria?: string;
}

// Aspect frontmatter projection. `kind: aspect` is the only kind produced by the bridge.
// `kind: policy` is preserved for shape parity but is not emitted.
export interface AspectFrontmatter {
  id: string;
  title: string;
  kind: "aspect" | "policy";
  appliesTo: string[];
  coveringLedger: string | null;
}

export interface AspectDeclaration {
  frontmatter: AspectFrontmatter;
  body: string;
  filePath: string;
  // First paragraph under `## 1. Why` (or `## Why`) — the aspect's intent
  // declaration in prose. Empty string if no Why section is present.
  whyDeclaration: string;
}

export type Role =
  | "undergraduate"
  | "master"
  | "phd"
  | "postdoc"
  | "researcher"
  | "industry"
  | "other";

// 하위호환을 위해 유지하되 optional
export type ResearchRole =
  | "exploration_convergence"
  | "alternative_perspective"
  | "direction_together";
export type CoreExpectation = "time_saving" | "idea_development" | "beyond_solo";
export type WorkApproach = "paper_curation" | "thought_structuring" | "reduce_repetition";

export type NarrativeStyle = "curie" | "darwin" | "feynman" | "nightingale" | "socrates";

type OpenText<T extends string> = T | (string & {});

export interface OnboardingResponses {
  role: OpenText<Role>;
  researchField: string;
  narrativeStyle?: OpenText<NarrativeStyle>;
  agentName: string;
  // 하위호환 (기존 데이터)
  researchRole?: OpenText<ResearchRole>;
  coreExpectation?: OpenText<CoreExpectation>;
  workApproach?: OpenText<WorkApproach>;
  userQuestion?: string;
}

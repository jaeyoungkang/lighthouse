// Story Chain snapshot source. The snapshot UI layer still consumes
// UsDeclaration / AspectDeclaration shapes, but every identifier emitted here is
// a canonical Story Chain ref.

import { existsSync, statSync } from "node:fs";
import path from "node:path";

import {
  type Aspect,
  type PromiseDeclaration,
  type PromiseRef,
  type EvidenceLedger,
  requirePromiseExperience,
} from "@/app/domain/story-chain";
import {
  STORY_CHAIN_DIR_REL,
  loadStoryChain,
  type StoryChain,
} from "@/app/server/services/story-chain/loader";

import {
  type ParsedCiqBlock,
  type AspectDeclaration,
  type UsDeclaration,
} from "@/scripts/mission-control/lib/intent-traceability-user-stories";

interface SnapshotSource {
  usDeclarations: UsDeclaration[];
  polDeclarations: AspectDeclaration[];
}

export function buildLegacySourceFromStoryChain(repoRoot: string): SnapshotSource {
  const experiencesDir = path.join(repoRoot, STORY_CHAIN_DIR_REL, "experiences");
  if (!existsSync(experiencesDir) || !statSync(experiencesDir).isDirectory()) {
    return { usDeclarations: [], polDeclarations: [] };
  }
  return synthesise(loadStoryChain(repoRoot));
}

export function buildUsDeclarationsFromStoryChain(chain: StoryChain): UsDeclaration[] {
  return synthesise(chain).usDeclarations;
}

export function buildAspectDeclarationsFromStoryChain(chain: StoryChain): AspectDeclaration[] {
  return synthesise(chain).polDeclarations;
}

export function loadUsDeclarationsFromStoryChain(repoRoot: string): UsDeclaration[] {
  return buildLegacySourceFromStoryChain(repoRoot).usDeclarations;
}

export function loadAspectDeclarationsFromStoryChain(repoRoot: string): AspectDeclaration[] {
  return buildLegacySourceFromStoryChain(repoRoot).polDeclarations;
}

function synthesise(chain: StoryChain): SnapshotSource {
  return {
    usDeclarations: chain.promises.map((promise) => {
      const experience = requirePromiseExperience(promise, chain.moments, chain.experiences);
      return synthesiseUs(promise, chain.evidenceLedgers, experience.scope);
    }),
    polDeclarations: chain.aspects.map((aspect) => synthesisePol(aspect)),
  };
}

function synthesiseUs(
  promise: PromiseDeclaration,
  ledgers: EvidenceLedger[],
  experienceScope: UsDeclaration["experienceScope"],
): UsDeclaration {
  const ciqBlocks: ParsedCiqBlock[] = promise.intentChecks.map((ic) => ({
    ciqId: ic.id,
    question: ic.question,
    evidencePath: ic.evidence,
    whyLiveJudge: ic.whyLiveJudge,
    linkedAcs: ic.linkedAcceptanceChecks.map((ref) => `${promise.id}#${ref}`),
    answerCriteria: ic.answerCriteria,
  }));
  const absorbedIntoAc =
    promise.intentChecks.length === 0 &&
    ledgers.some(
      (ledger) =>
        ledger.intentMode === "absorbed" &&
        ledger.sourcePromises.includes(promise.id) &&
        ledger.acceptanceCheckEntries.some((entry) => entry.sourcePromise === promise.id),
    );

  return {
    promiseRef: promise.id,
    title: promise.title,
    experienceScope,
    intent: deriveIntentFromPromise(promise),
    criticalQuestions: promise.intentChecks.map((ic) => ic.question),
    ciqBlocks,
    absorbedIntoAc,
    acceptanceCriteria: promise.acceptanceChecks.map((ac) => ac.description),
  };
}

function deriveIntentFromPromise(promise: PromiseDeclaration): string {
  const statement = promise.promiseStatement.trim();
  const wantMatch = statement.match(/I want\s+([\s\S]*?)(?:\n\s*\n|so that\b)/i);
  const soThatMatch = statement.match(/so that\s+([\s\S]*)/i);
  if (wantMatch && soThatMatch) {
    return `${wantMatch[1].trim()} — ${soThatMatch[1].trim().replace(/\s+/g, " ")}`;
  }
  if (wantMatch) return wantMatch[1].trim();
  return promise.title;
}

function synthesisePol(aspect: Aspect): AspectDeclaration {
  return {
    frontmatter: {
      id: aspect.id,
      title: aspect.title,
      kind: "aspect",
      appliesTo: aspect.appliesTo.map((ref: PromiseRef) => ref),
      coveringLedger: aspect.coveringLedger,
    },
    body: "",
    filePath: `docs/contracts/story-chain/aspects/${aspect.slug}.md`,
    whyDeclaration: aspect.whyDeclaration,
  };
}

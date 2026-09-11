import {
  type Aspect,
  type AspectRef,
  derivePromiseExperience,
  type EvidenceLedger,
  type ExperienceRef,
  type Moment,
  type PromiseDeclaration,
  type PromiseRef,
} from "@/app/domain/story-chain";

import { StoryChainParseError } from "./parser-shared";

export interface ResolveContext {
  promises: PromiseDeclaration[];
  aspects: Aspect[];
  experiences?: readonly ExperienceRef[];
  moments?: readonly Moment[];
}

export function resolvePromiseParents(
  promise: PromiseDeclaration,
  context: Pick<ResolveContext, "experiences" | "moments">,
): ExperienceRef | undefined {
  if (!context.moments) return undefined;
  const experience = derivePromiseExperience(promise, context.moments);
  if (!experience) {
    throw new StoryChainParseError(
      `${promise.id}: moment parent "${promise.moment}" is not declared in story-chain moments`,
    );
  }
  if (context.experiences && !context.experiences.includes(experience)) {
    throw new StoryChainParseError(
      `${promise.id}: derived experience parent "${experience}" from "${promise.moment}" is not declared in story-chain experiences`,
    );
  }
  return experience;
}

export function resolveEvidenceLedger(ledger: EvidenceLedger, context: ResolveContext): void {
  const promiseById = new Map(context.promises.map((promise) => [promise.id, promise]));
  const aspectById = new Map(context.aspects.map((aspect) => [aspect.id, aspect]));
  ledger.sourcePromises.forEach((promiseRef) => {
    const promise = promiseById.get(promiseRef);
    if (!promise) {
      throw new StoryChainParseError(
        `${ledger.path}: source promise "${promiseRef}" is not declared in story-chain promises`,
      );
    }
    resolvePromiseParents(promise, context);
  });
  ledger.appliedAspects.forEach((aspectRef) => {
    if (!aspectById.has(aspectRef)) {
      throw new StoryChainParseError(
        `${ledger.path}: applied aspect "${aspectRef}" is not declared as an Aspect`,
      );
    }
  });
  validatePromiseAspectReciprocal(ledger, promiseById, aspectById);

  const ensureOwned = (sourcePromise: PromiseRef, label: string): PromiseDeclaration => {
    if (!ledger.sourcePromises.includes(sourcePromise)) {
      throw new StoryChainParseError(
        `${ledger.path}: ${label} cites source promise "${sourcePromise}" not listed in sourcePromises`,
      );
    }
    const promise = promiseById.get(sourcePromise);
    if (!promise) {
      throw new StoryChainParseError(`${ledger.path}: missing Promise ${sourcePromise}`);
    }
    return promise;
  };
  ledger.intentCheckEntries.forEach((entry) => {
    const promise = ensureOwned(entry.sourcePromise, `intent-check "${entry.id}"`);
    if (!promise.intentChecks.some((check) => check.id === entry.id)) {
      throw new StoryChainParseError(
        `${ledger.path}: intent-check "${entry.id}" is not declared on its source promise "${entry.sourcePromise}"`,
      );
    }
  });
  ledger.intentDelegations.forEach((entry) => {
    const promise = ensureOwned(entry.sourcePromise, `intent-check delegation "${entry.check}"`);
    if (!promise.intentChecks.some((check) => check.id === entry.check)) {
      throw new StoryChainParseError(
        `${ledger.path}: delegated intent-check "${entry.check}" is not declared on "${entry.sourcePromise}"`,
      );
    }
  });
  ledger.acceptanceCheckEntries.forEach((entry) => {
    const promise = ensureOwned(entry.sourcePromise, `acceptance-check "${entry.check}"`);
    if (!promise.acceptanceChecks.some((check) => check.id === entry.check)) {
      throw new StoryChainParseError(
        `${ledger.path}: acceptance-check "${entry.check}" is not declared on its source promise "${entry.sourcePromise}"`,
      );
    }
  });
}

function validatePromiseAspectReciprocal(
  ledger: EvidenceLedger,
  promiseById: Map<PromiseRef, PromiseDeclaration>,
  aspectById: Map<AspectRef, Aspect>,
): void {
  ledger.sourcePromises.forEach((promiseRef) => {
    const promise = promiseById.get(promiseRef);
    if (!promise) return;
    ledger.appliedAspects.forEach((aspectRef) => {
      const aspect = aspectById.get(aspectRef);
      if (!aspect) return;
      if (!promise.aspects.includes(aspectRef)) {
        throw new StoryChainParseError(
          `${ledger.path}: applied aspect "${aspectRef}" is not declared on source promise "${promiseRef}" — promise.aspects must include the aspect for the weaving to be reciprocal`,
        );
      }
      if (!aspect.appliesTo.includes(promiseRef)) {
        throw new StoryChainParseError(
          `${ledger.path}: aspect "${aspectRef}".appliesTo does not include source promise "${promiseRef}" — aspect must declare its pointcut for the weaving to be reciprocal`,
        );
      }
    });
  });
}

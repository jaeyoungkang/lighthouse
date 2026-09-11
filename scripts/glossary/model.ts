import { z } from "zod";

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const koreanNamePattern = /^[가-힣A-Za-z0-9]+(?: [가-힣A-Za-z0-9]+)*$/;
const englishWordPattern = "(?:[A-Z][a-z]*|[A-Z]{2,})";
const englishNamePattern = new RegExp(`^${englishWordPattern}(?: ${englishWordPattern})*$`);
const aliasPattern = /^[가-힣A-Za-z0-9]+(?:[ ._-][가-힣A-Za-z0-9]+)*$/;
const authorityPattern = /^docs\/(?:[a-z0-9.-]+\/)*[a-z0-9.-]+\.md#[a-z0-9-]+$/;
const messageKeyPattern = /^[A-Za-z0-9.-]+$/;

function canonicalString(pattern: RegExp, label: string) {
  return z
    .string()
    .min(1)
    .refine((value) => value === value.normalize("NFC"), `${label} must use NFC`)
    .regex(pattern, `${label} contains characters outside the v1 vocabulary`);
}

const termSchema = z
  .object({
    id: z.string().regex(idPattern),
    ko: canonicalString(koreanNamePattern, "ko").refine(
      (value) => /[가-힣]/.test(value),
      "ko must contain a composed Hangul syllable",
    ),
    en: canonicalString(englishNamePattern, "en"),
    aliases: z.array(canonicalString(aliasPattern, "alias")),
    kind: z.enum(["story-chain-concept", "product-surface", "status-verdict"]),
    authorityRef: z
      .string()
      .regex(authorityPattern)
      .refine((value) => !value.includes("/../") && !value.includes("/./")),
  })
  .strict();

const i18nRefSchema = z
  .object({
    termId: z.string().regex(idPattern),
    key: z.string().regex(messageKeyPattern),
  })
  .strict();

const registrySchema = z
  .object({
    version: z.literal(1),
    terms: z.array(termSchema).min(1),
    i18nRefs: z.array(i18nRefSchema),
  })
  .strict();

export type GlossaryRegistry = z.infer<typeof registrySchema>;
export type GlossaryTerm = GlossaryRegistry["terms"][number];

export function normalizeLookup(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

export function parseGlossaryRegistry(input: unknown): GlossaryRegistry {
  const registry = registrySchema.parse(input);
  validateRelations(registry);
  return registry;
}

export function findGlossaryTerm(
  registry: GlossaryRegistry,
  query: string,
): GlossaryTerm | undefined {
  const identity = normalizeLookup(query);
  return registry.terms.find((term) =>
    [term.id, term.ko, term.en, ...term.aliases].some(
      (candidate) => normalizeLookup(candidate) === identity,
    ),
  );
}

export function validateI18nReferences(
  registry: GlossaryRegistry,
  messageMap: Readonly<Partial<Record<string, string>>>,
): void {
  const terms = new Map(registry.terms.map((term) => [term.id, term]));
  for (const reference of registry.i18nRefs) {
    const term = terms.get(reference.termId);
    const value = messageMap[reference.key];
    if (!term) {
      throw new Error(`unknown glossary i18nRef term id: ${reference.termId}`);
    }
    if (value === undefined) {
      throw new Error(`broken glossary i18nRef: ${reference.key}`);
    }
    if (value !== term.ko) {
      throw new Error(`glossary i18nRef must equal canonical ko "${term.ko}": ${reference.key}`);
    }
  }
}

function validateRelations(registry: GlossaryRegistry): void {
  const ids = new Set<string>();
  const identities = new Map<string, string>();

  for (const term of registry.terms) {
    if (ids.has(term.id)) {
      throw new Error(`duplicate glossary term id: ${term.id}`);
    }
    ids.add(term.id);

    const canonicalIdentities = new Set([term.id, term.ko, term.en].map(normalizeLookup));
    const aliasIdentities = new Set<string>();
    for (const alias of term.aliases) {
      const identity = normalizeLookup(alias);
      if (canonicalIdentities.has(identity) || aliasIdentities.has(identity)) {
        throw new Error(`glossary alias collision: ${alias} (${term.id})`);
      }
      aliasIdentities.add(identity);
    }

    for (const candidate of [term.id, term.ko, term.en, ...term.aliases]) {
      const identity = normalizeLookup(candidate);
      const owner = identities.get(identity);
      if (owner && owner !== term.id) {
        throw new Error(`glossary lookup collision: ${candidate} (${owner}, ${term.id})`);
      }
      identities.set(identity, term.id);
    }
  }

  const i18nOwners = new Set<string>();
  for (const reference of registry.i18nRefs) {
    assertTermExists(ids, reference.termId, "i18nRef");
    if (i18nOwners.has(reference.key)) {
      throw new Error(`duplicate glossary i18nRef owner: ${reference.key}`);
    }
    i18nOwners.add(reference.key);
  }
}

function assertTermExists(ids: Set<string>, termId: string, referenceType: string): void {
  if (!ids.has(termId)) {
    throw new Error(`unknown glossary ${referenceType} term id: ${termId}`);
  }
}

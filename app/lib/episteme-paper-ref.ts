/** Convert product paper identities to the provider-neutral Episteme 3 reference syntax. */
export function toEpisteme3PaperRef(paperId: string | number): string {
  const value = String(paperId).trim();
  return /^\d+$/.test(value) ? `s2:${value}` : value;
}

export function isEpisteme3PaperRef(paperId: string): boolean {
  const value = paperId.trim();
  return /^\d+$/.test(value) || /^(?:pap_|s2:|doi:|arxiv:|oa:|openalex:|pmid:)/i.test(value);
}

export function containsEpisteme3PaperRef(papers: readonly { paperId: string }[]): boolean {
  return papers.some((paper) => isEpisteme3PaperRef(paper.paperId));
}

type EpistemeIdentityCarrier = {
  paperId: string;
  source?: { canonicalPaperId?: string | null } | null;
  externalIds?: Record<string, string | number | null> | null;
};

function normalizedIdentity(value: string | number): string {
  const normalized = String(value).trim();
  return /^\d+$/.test(normalized) ? `s2:${normalized}` : normalized.toLowerCase();
}

export function getEpistemePaperIdentityAliases(paper: EpistemeIdentityCarrier): string[] {
  const aliases = new Set<string>();
  const addAlias = (value: string | number) => {
    const raw = String(value).trim();
    if (!raw) return;
    aliases.add(raw);
    aliases.add(normalizedIdentity(raw));
  };
  addAlias(paper.paperId);
  if (paper.source?.canonicalPaperId) addAlias(paper.source.canonicalPaperId);
  const corpusId = paper.externalIds?.CorpusId;
  if (corpusId != null) addAlias(corpusId);
  const openAlex = paper.externalIds?.OpenAlex;
  if (openAlex != null) {
    aliases.add(normalizedIdentity(`oa:${String(openAlex)}`));
    aliases.add(normalizedIdentity(`openalex:${String(openAlex)}`));
  }
  const doi = paper.externalIds?.DOI;
  if (doi != null) aliases.add(normalizedIdentity(`doi:${String(doi)}`));
  const arxiv = paper.externalIds?.ArXiv;
  if (arxiv != null) aliases.add(normalizedIdentity(`arxiv:${String(arxiv)}`));
  const pubMed = paper.externalIds?.PubMed;
  if (pubMed != null) aliases.add(normalizedIdentity(`pmid:${String(pubMed)}`));
  return [...aliases];
}

export function matchesEpistemePaperIdentity(
  paper: EpistemeIdentityCarrier,
  paperRef: string | number,
): boolean {
  return getEpistemePaperIdentityAliases(paper).includes(normalizedIdentity(paperRef));
}

export function indexByEpistemePaperIdentity<T extends EpistemeIdentityCarrier>(
  papers: readonly T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const paper of papers) {
    for (const alias of getEpistemePaperIdentityAliases(paper)) index.set(alias, paper);
  }
  return index;
}

export function lookupByEpistemePaperIdentity<T>(
  index: ReadonlyMap<string, T>,
  paperRef: string | number,
): T | undefined {
  return index.get(normalizedIdentity(paperRef));
}

export function getReviewedAtForEpistemePaper(
  paper: EpistemeIdentityCarrier,
  reviewedByPaperRef: ReadonlyMap<string, Date>,
): Date | undefined {
  let latest: Date | undefined;
  for (const alias of getEpistemePaperIdentityAliases(paper)) {
    const reviewedAt = reviewedByPaperRef.get(alias);
    if (reviewedAt && (!latest || reviewedAt > latest)) latest = reviewedAt;
  }
  return latest;
}

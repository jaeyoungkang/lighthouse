import {
  buildCitationSeedPageRoute,
  buildSearchRoutePageRoute,
  buildSimilarSeedPageRoute,
  type ConditionRouteBuildResult,
} from "@/app/lib/api-routes";
import {
  SEARCH_CONDITION_VALUE_LIMITS,
  utf8ByteLength,
} from "@/app/lib/search-condition-url-budget";
import type { PaperCore } from "@/app/domain/paper";

const MAXIMUM_PROFILE = "input:utf8-percent-expansion-v1";
const OVERFLOW_PROFILE = "input:utf8-one-byte-over-v1";

function repeatToUtf8Bytes(value: string, bytes: number): string {
  return value.repeat(bytes / utf8ByteLength(value));
}

function maximumFacetValues(kind: string): string[] {
  return Array.from(
    { length: SEARCH_CONDITION_VALUE_LIMITS.facetValuesPerKind },
    (_, index) =>
      `${repeatToUtf8Bytes(
        "😀",
        SEARCH_CONDITION_VALUE_LIMITS.facetValueBytes - 8,
      )}${kind}${String(index).padStart(7, "0")}`,
  );
}

function maximumSeed(): PaperCore {
  return {
    paperId: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.seedPaperIdBytes),
    title: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.seedPaperTitleBytes),
    abstract: null,
    year: SEARCH_CONDITION_VALUE_LIMITS.seedPaperYearMax,
    citationCount: SEARCH_CONDITION_VALUE_LIMITS.seedPaperCitationsMax,
    url: "%".repeat(SEARCH_CONDITION_VALUE_LIMITS.seedPaperUrlBytes),
    authors: [],
  };
}

function maximumSeedCardinalities(prefix: "search-seed" | "citation-seed" | "similar-seed") {
  return [
    {
      dimensionRef: `dimension:${prefix}-paper-id-utf8-bytes`,
      value: SEARCH_CONDITION_VALUE_LIMITS.seedPaperIdBytes,
    },
    {
      dimensionRef: `dimension:${prefix}-paper-title-utf8-bytes`,
      value: SEARCH_CONDITION_VALUE_LIMITS.seedPaperTitleBytes,
    },
    {
      dimensionRef: `dimension:${prefix}-paper-url-utf8-bytes`,
      value: SEARCH_CONDITION_VALUE_LIMITS.seedPaperUrlBytes,
    },
    {
      dimensionRef: `dimension:${prefix}-paper-year`,
      value: SEARCH_CONDITION_VALUE_LIMITS.seedPaperYearMax,
    },
    {
      dimensionRef: `dimension:${prefix}-paper-citations`,
      value: SEARCH_CONDITION_VALUE_LIMITS.seedPaperCitationsMax,
    },
  ];
}

function measurement(
  scenarioRef: string,
  boundaryRef: string,
  inputProfileRef: string,
  cardinalities: Array<{ dimensionRef: string; value: number }>,
  result: ConditionRouteBuildResult,
) {
  return {
    id: `measurement:${scenarioRef.replace("scenario:", "")}`,
    scenarioRef,
    boundaryRef,
    inputProfileRef,
    cardinalities,
    result: result.ok
      ? {
          kind: "serialized" as const,
          serializedBytes: utf8ByteLength(result.route),
          effectiveCardinalities: cardinalities,
        }
      : { kind: "rejected" as const },
  };
}

function keywordMeasurements() {
  const cardinalities = [
    {
      dimensionRef: "dimension:keyword-query-utf8-bytes",
      value: SEARCH_CONDITION_VALUE_LIMITS.keywordQueryBytes,
    },
    {
      dimensionRef: "dimension:field-count",
      value: SEARCH_CONDITION_VALUE_LIMITS.facetValuesPerKind,
    },
    {
      dimensionRef: "dimension:field-value-utf8-bytes",
      value: SEARCH_CONDITION_VALUE_LIMITS.facetValueBytes,
    },
    {
      dimensionRef: "dimension:author-count",
      value: SEARCH_CONDITION_VALUE_LIMITS.facetValuesPerKind,
    },
    {
      dimensionRef: "dimension:author-value-utf8-bytes",
      value: SEARCH_CONDITION_VALUE_LIMITS.facetValueBytes,
    },
    {
      dimensionRef: "dimension:venue-count",
      value: SEARCH_CONDITION_VALUE_LIMITS.facetValuesPerKind,
    },
    {
      dimensionRef: "dimension:venue-value-utf8-bytes",
      value: SEARCH_CONDITION_VALUE_LIMITS.facetValueBytes,
    },
    {
      dimensionRef: "dimension:year-utf8-bytes",
      value: SEARCH_CONDITION_VALUE_LIMITS.yearBytes,
    },
  ];
  const maximum = buildSearchRoutePageRoute({
    q: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.keywordQueryBytes),
    sort: "citationCount",
    year: "2020-2026",
    personalize: false,
    libraryContextAvailable: true,
    entry: "requery",
    facetFilters: {
      fieldsOfStudy: maximumFacetValues("f"),
      authors: maximumFacetValues("a"),
      venues: maximumFacetValues("v"),
      hasPdf: true,
    },
  });
  const overflowCardinalities = cardinalities.map((item) =>
    item.dimensionRef === "dimension:keyword-query-utf8-bytes"
      ? { ...item, value: item.value + 1 }
      : item,
  );
  return [
    measurement(
      "scenario:search-keyword-envelope-maximum",
      "boundary:search-keyword-condition-url",
      MAXIMUM_PROFILE,
      cardinalities,
      maximum,
    ),
    measurement(
      "scenario:search-keyword-overflow",
      "boundary:search-keyword-condition-url",
      OVERFLOW_PROFILE,
      overflowCardinalities,
      buildSearchRoutePageRoute({
        q: `${"a".repeat(SEARCH_CONDITION_VALUE_LIMITS.keywordQueryBytes)} `,
      }),
    ),
  ];
}

function termMeasurements() {
  const cardinalities = [
    {
      dimensionRef: "dimension:term-followup-query-utf8-bytes",
      value: SEARCH_CONDITION_VALUE_LIMITS.followupQueryBytes,
    },
    {
      dimensionRef: "dimension:term-source-query-utf8-bytes",
      value: SEARCH_CONDITION_VALUE_LIMITS.termSourceQueryBytes,
    },
    {
      dimensionRef: "dimension:term-utf8-bytes",
      value: SEARCH_CONDITION_VALUE_LIMITS.termBytes,
    },
    {
      dimensionRef: "dimension:term-support-count",
      value: SEARCH_CONDITION_VALUE_LIMITS.termSupportMax,
    },
  ];
  return [
    measurement(
      "scenario:search-term-envelope-maximum",
      "boundary:search-term-condition-url",
      MAXIMUM_PROFILE,
      cardinalities,
      buildSearchRoutePageRoute({
        q: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.followupQueryBytes),
        personalize: false,
        libraryContextAvailable: true,
        entry: "term",
        termSeed: {
          sourceQuery: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.termSourceQueryBytes),
          term: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.termBytes),
          candidateType: "narrower",
          supportCount: SEARCH_CONDITION_VALUE_LIMITS.termSupportMax,
        },
      }),
    ),
    measurement(
      "scenario:search-term-overflow",
      "boundary:search-term-condition-url",
      OVERFLOW_PROFILE,
      cardinalities.map((item) =>
        item.dimensionRef === "dimension:term-utf8-bytes"
          ? { ...item, value: item.value + 1 }
          : item,
      ),
      buildSearchRoutePageRoute({
        q: "term",
        termSeed: {
          sourceQuery: "source",
          term: "a".repeat(SEARCH_CONDITION_VALUE_LIMITS.termBytes + 1),
          candidateType: "direct",
          supportCount: 1,
        },
      }),
    ),
  ];
}

function seedMeasurements() {
  const cardinalities = [
    {
      dimensionRef: "dimension:search-seed-followup-query-utf8-bytes",
      value: SEARCH_CONDITION_VALUE_LIMITS.followupQueryBytes,
    },
    ...maximumSeedCardinalities("search-seed"),
  ];
  return [
    measurement(
      "scenario:search-seed-envelope-maximum",
      "boundary:search-seed-condition-url",
      MAXIMUM_PROFILE,
      cardinalities,
      buildSearchRoutePageRoute({
        q: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.followupQueryBytes),
        entry: "similar",
        seedPaper: maximumSeed(),
      }),
    ),
    measurement(
      "scenario:search-seed-overflow",
      "boundary:search-seed-condition-url",
      OVERFLOW_PROFILE,
      cardinalities.map((item) =>
        item.dimensionRef === "dimension:search-seed-paper-title-utf8-bytes"
          ? { ...item, value: item.value + 1 }
          : item,
      ),
      buildSearchRoutePageRoute({
        q: "seed",
        seedPaper: {
          ...maximumSeed(),
          title: `${repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.seedPaperTitleBytes)}a`,
        },
      }),
    ),
  ];
}

function relationshipMeasurements(
  routeKind: "citation" | "similar",
  builder: (paper: PaperCore) => ConditionRouteBuildResult,
) {
  const cardinalities = maximumSeedCardinalities(`${routeKind}-seed`);
  return [
    measurement(
      `scenario:${routeKind}-seed-envelope-maximum`,
      `boundary:${routeKind}-seed-condition-url`,
      MAXIMUM_PROFILE,
      cardinalities,
      builder(maximumSeed()),
    ),
    measurement(
      `scenario:${routeKind}-seed-overflow`,
      `boundary:${routeKind}-seed-condition-url`,
      OVERFLOW_PROFILE,
      cardinalities.map((item) =>
        item.dimensionRef === `dimension:${routeKind}-seed-paper-title-utf8-bytes`
          ? { ...item, value: item.value + 1 }
          : item,
      ),
      builder({
        ...maximumSeed(),
        title: `${repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.seedPaperTitleBytes)}a`,
      }),
    ),
  ];
}

const output = {
  boundaries: [
    {
      boundaryRef: "boundary:search-keyword-condition-url",
      serializerRef: "serializer:build-search-route-page-route-keyword-v1",
    },
    {
      boundaryRef: "boundary:search-term-condition-url",
      serializerRef: "serializer:build-search-route-page-route-term-v1",
    },
    {
      boundaryRef: "boundary:search-seed-condition-url",
      serializerRef: "serializer:build-search-route-page-route-seed-v1",
    },
    {
      boundaryRef: "boundary:citation-seed-condition-url",
      serializerRef: "serializer:build-citation-seed-page-route-v1",
    },
    {
      boundaryRef: "boundary:similar-seed-condition-url",
      serializerRef: "serializer:build-similar-seed-page-route-v1",
    },
  ],
  measurements: [
    ...keywordMeasurements(),
    ...termMeasurements(),
    ...seedMeasurements(),
    ...relationshipMeasurements("citation", buildCitationSeedPageRoute),
    ...relationshipMeasurements("similar", buildSimilarSeedPageRoute),
  ],
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

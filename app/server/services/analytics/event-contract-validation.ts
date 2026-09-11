import type {
  AnalyticsEventContract,
  AnalyticsEventDefinition,
  AnalyticsPropertySchema,
  AnalyticsPropertyType,
} from "./event-contract-types";

const USER_ACTION_EVENT_VERBS = new Set([
  "clicked",
  "viewed",
  "submitted",
  "queued",
  "failed",
  "inspected",
  "saved",
  "unsaved",
  "opened",
]);
const GOVERNANCE_EVENT_VERBS = new Set(["synced", "failed"]);
const ACTIVE_PRODUCT_EVENT_NAME_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const ANALYTICS_PROPERTY_NAME_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const ANALYTICS_TAXONOMY_TOKEN_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const LEGACY_PRODUCT_EVENT_NAMES = new Set([
  "product.search_language_aware_library_supplement.viewed",
  "product.search_term_candidate.clicked",
  "product.research_terms.viewed",
  "product.different_position_search.clicked",
  "product.citation_lineage.failed",
  "product.graph_neighbors.viewed",
  "product.graph_neighbors.failed",
  "product.gap_report.clicked",
  "product.gap_report.viewed",
  "product.ai_comment_card.viewed",
  "product.ai_comment_card_expand.clicked",
  "product.ai_comment_regenerate.clicked",
  "product.spelling_correction.clicked",
  "product.researcher_prose_promises_page.clicked",
  "product.gap_view_margin.viewed",
  "product.gap_view_prepared_reaction.viewed",
  "product.gap_overlay_decision_evidence.clicked",
  "product.ai_content_feedback.submitted",
  "product.gap_led_next_search.clicked",
  "product.research_auth_challenge.viewed",
]);
const KNOWN_ANALYTICS_EMITTERS = new Set([
  "trackGapAnalysisRetryClicked",
  "trackSearchSubmitted",
  "trackSearchResultsViewed",
  "trackSearchResultInspected",
  "trackPaperSaved",
  "trackPaperUnsaved",
  "trackSearchLanguageAwareLibrarySupplementViewedOnce",
  "trackSearchTermCandidateClicked",
  "trackDifferentPositionSearchClicked",
  "trackPaperPdfOpened",
  "trackCitationLineageOpened",
  "trackCitationLineageFailed",
  "trackGraphNeighborsViewed",
  "trackGraphNeighborsFailed",
  "trackResearchTermsViewedOnce",
  "trackGapReportClicked",
  "trackGapReportViewedOnce",
  "trackGapLedNextSearchClicked",
  "trackSpellingCorrectionClicked",
  "trackAboutCommitmentLinkClicked",
  "trackResearchAuthChallengeViewed",
  "trackAiCommentCardViewedOnce",
  "trackAiCommentCardExpandClicked",
  "trackAiCommentRegenerateClicked",
  "trackGapViewMarginViewedOnce",
  "trackGapViewPreparedReactionViewedOnce",
  "trackPdfFigureTableInterpretationClicked",
  "trackSimilarPapersOpened",
  "trackGapOverlayDecisionEvidenceClicked",
  "trackAiContentFeedbackSubmitted",
  "trackAdminInvitedAccessMembershipSynced",
]);

export function validateDuplicateValues(
  values: readonly string[],
  label: string,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`${label}: duplicate "${value}"`);
    seen.add(value);
  }
}

export function validateSinkNames(contract: AnalyticsEventContract, errors: string[]): void {
  const sinkNamesBySink = new Map<string, string[]>();
  for (const event of contract.events) {
    for (const [sink, sinkName] of Object.entries(event.sinks)) {
      const names = sinkNamesBySink.get(sink) ?? [];
      names.push(sinkName);
      sinkNamesBySink.set(sink, names);
    }
  }
  for (const [sink, names] of sinkNamesBySink) {
    validateDuplicateValues(names, `sink ${sink}`, errors);
  }
}

export function validateEventShape(
  event: AnalyticsEventDefinition,
  contract: AnalyticsEventContract,
  errors: string[],
  warnings: string[],
): void {
  const legacyProductEvent =
    event.owner === "product" && LEGACY_PRODUCT_EVENT_NAMES.has(event.name);
  const activeProductEvent = event.owner === "product" && !legacyProductEvent;
  const eventVerb = event.name.split(/[._]/).at(-1);
  if (activeProductEvent) {
    validateActiveProductEventNaming(event, eventVerb, errors);
  } else {
    validateLegacyEventNaming(event, eventVerb, warnings);
  }
  validateEventWarnings(event, eventVerb, warnings);
  const usedProperties = [...event.properties.required, ...event.properties.optional];
  validateEventProperties(event, contract, usedProperties, activeProductEvent, errors);
  validateEventEmission(event, errors);
  validateEventMeasurement(event, errors);
}

function validateLegacyEventNaming(
  event: AnalyticsEventDefinition,
  eventVerb: string | undefined,
  warnings: string[],
): void {
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(event.name)) {
    warnings.push(`${event.name}: legacy event name should use a dotted namespace`);
  }
  if (event.owner === "product" && !USER_ACTION_EVENT_VERBS.has(eventVerb ?? "")) {
    warnings.push(
      `${event.name}: product event name should end with a user-action verb such as clicked, viewed, submitted, queued, or failed`,
    );
  }
}

function validateEventWarnings(
  event: AnalyticsEventDefinition,
  eventVerb: string | undefined,
  warnings: string[],
): void {
  if (event.owner === "governance" && !GOVERNANCE_EVENT_VERBS.has(eventVerb ?? "")) {
    warnings.push(`${event.name}: governance event name should end with synced or failed`);
  }
  if (event.owner === "product" && (event.surface === "cli" || event.surface === "ci")) {
    warnings.push(`${event.name}: product event should not use ${event.surface} surface`);
  }
  if (event.owner === "governance" && event.name.startsWith("product.")) {
    warnings.push(`${event.name}: governance event should not use product namespace`);
  }
  if (event.observability.realitySignal && !event.storyRefs.promiseRef) {
    warnings.push(`${event.name}: reality signal events should name a promiseRef`);
  }
}

function validateEventProperties(
  event: AnalyticsEventDefinition,
  contract: AnalyticsEventContract,
  usedProperties: string[],
  activeProductEvent: boolean,
  errors: string[],
): void {
  if (event.privacy.allowExternalSinks && event.privacy.level === "restricted") {
    errors.push(`${event.name}: restricted events cannot allow external sinks`);
  }
  if (activeProductEvent) {
    for (const property of [...event.subject.allowed, ...usedProperties]) {
      if (!ANALYTICS_PROPERTY_NAME_PATTERN.test(property)) {
        errors.push(`${event.name}: analytics subject/property "${property}" must use snake_case`);
      }
    }
  }
  for (const forbidden of event.properties.forbidden) {
    if (usedProperties.includes(forbidden)) {
      errors.push(`${event.name}: forbidden property "${forbidden}" is also required/optional`);
    }
  }
  if (!activeProductEvent) return;
  for (const property of usedProperties) {
    if (!contract.propertySchemas?.[property]) {
      errors.push(`${event.name}: propertySchemas missing "${property}"`);
    }
  }
}

function validateActiveProductEventNaming(
  event: AnalyticsEventDefinition,
  eventVerb: string | undefined,
  errors: string[],
): void {
  if (!ACTIVE_PRODUCT_EVENT_NAME_PATTERN.test(event.name)) {
    errors.push(`${event.name}: active product event name must use <object>_<past_tense_action>`);
  }
  if (!USER_ACTION_EVENT_VERBS.has(eventVerb ?? "")) {
    errors.push(
      `${event.name}: active product event name must end with an approved past-tense action`,
    );
  }
  const amplitudeName = event.sinks.amplitude;
  if (amplitudeName && amplitudeName !== event.name) {
    errors.push(`${event.name}: Amplitude sink name must match the canonical snake_case name`);
  }
}

function valueMatchesPropertyType(value: unknown, type: AnalyticsPropertyType): boolean {
  if (type === "string") return typeof value === "string";
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "string_or_null") return value === null || typeof value === "string";
  return value === null || (typeof value === "number" && Number.isInteger(value));
}

export function validatePropertySchemas(contract: AnalyticsEventContract, errors: string[]): void {
  for (const [name, schema] of Object.entries(contract.propertySchemas ?? {})) {
    validatePropertySchema(name, schema, errors);
  }
}

function validatePropertySchema(
  name: string,
  schema: AnalyticsPropertySchema,
  errors: string[],
): void {
  if (!ANALYTICS_PROPERTY_NAME_PATTERN.test(name)) {
    errors.push(`${name}: analytics property name must use snake_case`);
  }
  for (const example of schema.examples) {
    if (!valueMatchesPropertyType(example, schema.type)) {
      errors.push(`${name}: example does not match property type "${schema.type}"`);
    }
  }
  for (const value of schema.enum ?? []) {
    if (!valueMatchesPropertyType(value, schema.type)) {
      errors.push(`${name}: enum value does not match property type "${schema.type}"`);
    }
    if (typeof value === "string" && !ANALYTICS_TAXONOMY_TOKEN_PATTERN.test(value)) {
      errors.push(`${name}: string enum value "${value}" must use lowercase snake_case`);
    }
  }
  if (
    schema.range?.min !== undefined &&
    schema.range.max !== undefined &&
    schema.range.min > schema.range.max
  ) {
    errors.push(`${name}: range.min must be less than or equal to range.max`);
  }
  if (schema.sensitivity === "restricted") {
    errors.push(`${name}: restricted properties cannot be declared for external product events`);
  }
}

function validateEventEmission(event: AnalyticsEventDefinition, errors: string[]): void {
  if (!event.emission) {
    errors.push(`${event.name}: emission contract is required`);
    return;
  }
  if (event.emission.cardinality !== "every_action" && event.emission.identityKeys.length === 0) {
    errors.push(
      `${event.name}: emission.identityKeys are required for ${event.emission.cardinality}`,
    );
  }
  if (!KNOWN_ANALYTICS_EMITTERS.has(event.emission.emitter)) {
    errors.push(`${event.name}: emission emitter "${event.emission.emitter}" is not registered`);
  }
  for (const path of event.emission.identityKeys) {
    if (path === "actor.id" || path === "deviceId") continue;
    if (path.startsWith("subject.")) {
      const subjectKey = path.slice("subject.".length);
      if (!event.subject.allowed.includes(subjectKey)) {
        errors.push(`${event.name}: emission identity key "${path}" is not an allowed subject key`);
      }
      continue;
    }
    if (path.startsWith("properties.")) {
      const propertyKey = path.slice("properties.".length);
      const allowedProperties = [...event.properties.required, ...event.properties.optional];
      if (!allowedProperties.includes(propertyKey)) {
        errors.push(`${event.name}: emission identity key "${path}" is not a declared property`);
      }
      continue;
    }
    errors.push(`${event.name}: emission identity key "${path}" is not supported`);
  }
}

function validateEventMeasurement(event: AnalyticsEventDefinition, errors: string[]): void {
  if (event.owner !== "product") return;
  if (!event.measurement) {
    errors.push(`${event.name}: product events must declare measurement purpose`);
    return;
  }
  const declaredProperties = [...event.properties.required, ...event.properties.optional];
  for (const property of declaredProperties) {
    const propertyPurpose = event.measurement.propertyPurposes[property];
    if (!propertyPurpose) {
      errors.push(`${event.name}: measurement.propertyPurposes missing "${property}"`);
    } else if (
      propertyPurpose.length < 20 ||
      /only for the declared .* measurement/i.test(propertyPurpose)
    ) {
      errors.push(
        `${event.name}: measurement.propertyPurposes.${property} must name a concrete analytic use`,
      );
    }
  }
  if (
    event.name === "search_result_inspected" &&
    (event.properties.required.includes("owner_principal_id") ||
      event.emission?.identityKeys.includes("subject.owner_principal_id") ||
      event.emission?.identityKeys.includes("properties.owner_principal_id"))
  ) {
    errors.push(
      "search_result_inspected: owner_principal_id is not allowed as a required property or identity key",
    );
  }
}

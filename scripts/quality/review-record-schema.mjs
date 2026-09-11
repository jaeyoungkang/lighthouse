const TIMESTAMP_SEGMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATE_SEGMENT = /^\d{4}-\d{2}-\d{2}$/;
const HEAD_VALUE = /^([0-9a-f]{12,40})(\+dirty)?$/;
const MODEL_ID_COMPONENT = /^(?:human|(?=[a-z0-9._:/-]*[a-z])[a-z0-9][a-z0-9._:/-]+)$/i;
const CHECKLIST_ENTRY = /^(?:candidate:)?[a-z][a-z0-9-]*-\d+$/;

export const REVIEW_RECORD_POLICY = Object.freeze({
  requiredModelFields: Object.freeze(["author-model", "review-model", "verdict-model"]),
  invalidModelValues: Object.freeze(["none", "unknown", "n/a", "na", "tbd"]),
  movingModelAliases: Object.freeze(["opus", "latest"]),
  validHitEntry: "<active-or-workflow-entry-id | none>",
  validEscapeEntry: "<active-or-workflow-entry-id | candidate:stable-entry-id>",
});

const invalidModelValues = new Set(REVIEW_RECORD_POLICY.invalidModelValues);
const movingModelAliases = new Set(REVIEW_RECORD_POLICY.movingModelAliases);

function parseFields(line) {
  const segments = line.split("|").map((segment) => segment.trim());
  if (!TIMESTAMP_SEGMENT.test(segments[0] ?? "")) return null;
  return parseSegments(segments.slice(1));
}

function parseSegments(segments) {
  const fields = new Map();
  for (const segment of segments) {
    const separator = segment.indexOf(":");
    if (separator < 1) continue;
    const key = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();
    const values = fields.get(key) ?? [];
    values.push(value);
    fields.set(key, values);
  }
  return fields;
}

export function parseReviewRecord(line) {
  const fields = parseFields(line);
  const headValues = fields?.get("head");
  if (!headValues || headValues.length !== 1) return null;

  const match = headValues[0].match(HEAD_VALUE);
  if (!match) return null;
  return {
    head: match[1],
    dirty: Boolean(match[2]),
    fields,
  };
}

export function parseEscapeRecord(line) {
  const segments = line.split("|").map((segment) => segment.trim());
  if (!DATE_SEGMENT.test(segments[0] ?? "") || segments[1] !== "escape") return null;
  const fields = parseSegments(segments.slice(2));
  return {
    fields,
    head: fields.get("head")?.[0] ?? "missing",
    finding: fields.get("finding")?.[0] ?? "missing",
  };
}

function validateModelValue(field, value) {
  const components = value.split("+").map((component) => component.trim());
  if (
    value.length === 0 ||
    components.some(
      (component) => invalidModelValues.has(component.toLowerCase()) || /^<[^>]+>$/.test(component),
    )
  ) {
    return `${field} has placeholder value '${value}'`;
  }
  if (components.some((component) => movingModelAliases.has(component.toLowerCase()))) {
    return `${field} has moving alias '${value}'`;
  }
  if (components.some((component) => !MODEL_ID_COMPONENT.test(component))) {
    return `${field} has invalid model id '${value}'`;
  }
  return null;
}

export function validateModelAttribution(record) {
  const problems = [];
  for (const field of REVIEW_RECORD_POLICY.requiredModelFields) {
    const values = record.fields.get(field) ?? [];
    if (values.length === 0) {
      problems.push(`${field} missing`);
      continue;
    }
    if (values.length > 1) {
      problems.push(`${field} duplicated`);
      continue;
    }
    const problem = validateModelValue(field, values[0]);
    if (problem) problems.push(problem);
  }
  return problems;
}

export function validateAppliedGroups(record, currentGroups) {
  const values = record.fields.get("applied") ?? [];
  if (values.length === 0) return ["applied missing"];
  if (values.length > 1) return ["applied duplicated"];
  const groups = values[0]
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);
  if (groups.length === 0) return ["applied has no group ids"];
  const problems = [];
  if (new Set(groups).size !== groups.length) problems.push("applied contains duplicate group ids");
  const staleGroups = groups.filter((group) => !currentGroups.has(group));
  if (staleGroups.length > 0) {
    problems.push(`applied names non-current group(s): ${staleGroups.join(", ")}`);
  }
  return problems;
}

export function validateHitEntries(record, acceptedEntries) {
  const values = record.fields.get("hit") ?? [];
  if (values.length === 0) return ["hit missing"];
  if (values.length > 1) return ["hit duplicated"];
  if (values[0] === "none") return [];
  const entries = [
    ...values[0].matchAll(/(?:^|[;,]\s*)([a-z][a-z0-9/-]*-\d+)\s*(?=:|$|[;,])/g),
  ].map((match) => match[1]);
  if (entries.length === 0) return ["hit has no checklist entry ids"];
  const invalidEntries = [...new Set(entries)].filter((entry) => !acceptedEntries.has(entry));
  const problems = [];
  if (invalidEntries.length > 0) {
    problems.push(`hit names non-current or unknown entry(s): ${invalidEntries.join(", ")}`);
  }
  return problems;
}

export function validateEscapeFeedback(record, checklistEntries) {
  const classifications = record.fields.get("classification") ?? [];
  if (classifications.length === 0) return ["escape classification missing"];
  if (classifications.length > 1) return ["escape classification duplicated"];
  if (classifications[0] !== "valid") return [];
  const entries = record.fields.get("entry") ?? [];
  if (entries.length === 0) return ["valid escape entry missing"];
  if (entries.length > 1) return ["valid escape entry duplicated"];
  if (entries[0] === "none") return ["valid escape may not use entry:none"];
  if (!CHECKLIST_ENTRY.test(entries[0])) {
    return [`valid escape entry '${entries[0]}' is not an entry id or candidate id`];
  }
  if (entries[0].startsWith("candidate:")) {
    const candidate = entries[0].slice("candidate:".length);
    if (!checklistEntries.candidates.has(candidate)) {
      return [`valid escape candidate '${candidate}' is not a checklist candidate at HEAD`];
    }
  } else if (!checklistEntries.accepted.has(entries[0])) {
    const status = checklistEntries.statuses.get(entries[0]);
    if (status) {
      return [
        `valid escape entry '${entries[0]}' has status '${status}'; use its active/workflow owner`,
      ];
    }
    return [`valid escape entry '${entries[0]}' does not exist in the checklist at HEAD`];
  }
  return [];
}

function countLines(value) {
  const counts = new Map();
  for (const line of value.split("\n")) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}

function findAddedRecords(baseValue, headValue, parser) {
  const remainingBaseLines = countLines(baseValue);
  const records = [];
  for (const line of headValue.split("\n")) {
    const remaining = remainingBaseLines.get(line) ?? 0;
    if (remaining > 0) {
      remainingBaseLines.set(line, remaining - 1);
      continue;
    }
    const record = parser(line);
    if (record) records.push(record);
  }
  return records;
}

export function findAddedReviewRecords(baseValue, headValue) {
  return findAddedRecords(baseValue, headValue, parseReviewRecord);
}

export function findAddedEscapeRecords(baseValue, headValue) {
  return findAddedRecords(baseValue, headValue, parseEscapeRecord);
}

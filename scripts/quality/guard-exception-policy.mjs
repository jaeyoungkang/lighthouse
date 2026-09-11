const REQUIRED_EXCEPTION_METADATA = ["reason", "owner", "reviewWhen"];

// `owner` names the accountable workflow or policy authority that must review
// and retire the exception. It is deliberately distinct from the path or chain
// being excepted, which belongs in guard-specific match fields.
export function defineGuardExceptions(guard, entries, options = {}) {
  if (typeof guard !== "string" || guard.trim().length === 0) {
    throw new TypeError("guard exception declarations require a non-empty guard id");
  }
  if (!Array.isArray(entries)) {
    throw new TypeError(`[${guard}] guard exceptions must be an array`);
  }
  const requiredMatchFields = options.requiredMatchFields ?? [];
  if (
    !Array.isArray(requiredMatchFields) ||
    requiredMatchFields.some((field) => typeof field !== "string" || field.trim().length === 0)
  ) {
    throw new TypeError(`[${guard}] requiredMatchFields must contain non-empty field names`);
  }

  const ids = new Set();
  const declared = entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError(`[${guard}] exception #${index + 1} must be an object`);
    }

    if (typeof entry.id !== "string" || entry.id.trim().length === 0) {
      throw new TypeError(`[${guard}] exception #${index + 1} requires a non-empty id`);
    }
    if (ids.has(entry.id)) {
      throw new TypeError(`[${guard}] duplicate exception id: ${entry.id}`);
    }
    ids.add(entry.id);

    for (const field of REQUIRED_EXCEPTION_METADATA) {
      if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
        throw new TypeError(
          `[${guard}] exception ${entry.id} requires non-empty ${field} metadata`,
        );
      }
    }
    for (const field of requiredMatchFields) {
      if (typeof entry[field] !== "string" || entry[field].trim().length === 0) {
        throw new TypeError(
          `[${guard}] exception ${entry.id} requires non-empty ${field} match data`,
        );
      }
      if (entry.owner === entry[field]) {
        throw new TypeError(
          `[${guard}] exception ${entry.id} owner must identify accountable authority, not repeat ${field}`,
        );
      }
    }

    return Object.freeze({ ...entry });
  });

  return Object.freeze(declared);
}

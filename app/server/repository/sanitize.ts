const NULL_CHARACTER_REGEX = /\u0000/g;

export function sanitizeText(value: string): string {
  return value.replace(NULL_CHARACTER_REGEX, "");
}

function sanitizeUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item));
  }

  if (value && typeof value === "object") {
    const sanitizedEntries = Object.entries(value).map(([key, nestedValue]): [string, unknown] => [
      key,
      sanitizeUnknown(nestedValue),
    ]);
    return Object.fromEntries(sanitizedEntries);
  }

  return value;
}

export function sanitizeForDatabase<T>(value: T): T {
  return sanitizeUnknown(value) as T;
}

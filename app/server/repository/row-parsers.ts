import type { ZodType } from "zod";

function buildParseError(context: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`[repository] ${context}: ${error.message}`, { cause: error });
  }

  return new Error(`[repository] ${context}: invalid row payload`);
}

export function parseSingleRow<T>(schema: ZodType<T>, data: unknown, context: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw buildParseError(context, parsed.error);
  }

  return parsed.data;
}

export function parseOptionalSingleRow<T>(
  schema: ZodType<T>,
  data: unknown,
  context: string,
): T | null {
  if (data == null) {
    return null;
  }

  return parseSingleRow(schema, data, context);
}

export function parseRows<T>(schema: ZodType<T>, data: unknown, context: string): T[] {
  const parsed = schema.array().safeParse(data ?? []);
  if (!parsed.success) {
    throw buildParseError(context, parsed.error);
  }

  return parsed.data;
}

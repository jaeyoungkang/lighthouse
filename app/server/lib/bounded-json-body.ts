export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request body is too large");
    this.name = "RequestBodyTooLargeError";
  }
}

const MAX_UTF8_BYTES_PER_CHARACTER = 4;

export type BoundedJsonBodyLimit = number | { maxBytes: number; maxChars?: number };

export async function readBoundedJsonBody(
  request: Request,
  limit: BoundedJsonBodyLimit,
): Promise<unknown> {
  const maxChars = typeof limit === "number" ? limit : limit.maxChars;
  const maxBytes =
    typeof limit === "number" ? limit * MAX_UTF8_BYTES_PER_CHARACTER : limit.maxBytes;
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  const decodedChunks: string[] = [];
  let decodedLength = 0;
  let receivedBytes = 0;

  const rejectOversizedBody = (): never => {
    void reader.cancel().catch(() => undefined);
    throw new RequestBodyTooLargeError();
  };

  try {
    let nextChunk = await reader.read();
    while (!nextChunk.done) {
      const { value } = nextChunk;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) rejectOversizedBody();

      const decodedChunk = decoder.decode(value, { stream: true });
      decodedLength += decodedChunk.length;
      if (maxChars !== undefined && decodedLength > maxChars) rejectOversizedBody();
      decodedChunks.push(decodedChunk);
      nextChunk = await reader.read();
    }

    const finalChunk = decoder.decode();
    decodedLength += finalChunk.length;
    if (maxChars !== undefined && decodedLength > maxChars) rejectOversizedBody();
    decodedChunks.push(finalChunk);
  } finally {
    reader.releaseLock();
  }

  const rawBody = decodedChunks.join("");
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

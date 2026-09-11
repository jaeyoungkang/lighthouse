const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

export function utf8ByteLength(value: string): number {
  return UTF8_ENCODER.encode(value).byteLength;
}

export function truncateUtf8(value: string, maxBytes: number): string {
  const encoded = UTF8_ENCODER.encode(value);
  if (encoded.byteLength <= maxBytes) return value;
  if (maxBytes <= 0) return "";

  let end = maxBytes;
  while (end > 0 && (encoded[end] & 0xc0) === 0x80) end -= 1;
  return UTF8_DECODER.decode(encoded.subarray(0, end));
}

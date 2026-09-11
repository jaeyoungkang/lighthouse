import { describe, expect, it } from "vitest";
import { utf8ByteLength } from "@/app/lib/utf8";
import {
  ERROR_LOG_METADATA_LIMITS,
  ERROR_LOG_METADATA_TRUNCATED_KEY,
  sanitizeErrorLogMetadata,
} from "@/app/server/lib/error-log-metadata";

function metadataBytes(value: Record<string, unknown>): number {
  return utf8ByteLength(JSON.stringify(value));
}

function metadataWithExactJsonBytes(targetBytes: number): Record<string, unknown> {
  const prefix = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [`key-${String(index)}`, "x".repeat(2_048)]),
  );
  const emptyFinal = { ...prefix, final: "" };
  const finalLength = targetBytes - metadataBytes(emptyFinal);
  const metadata = { ...prefix, final: "x".repeat(finalLength) };
  expect(metadataBytes(metadata)).toBe(targetBytes);
  return metadata;
}

function metadataWithVisitedValueCount(targetCount: number): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  let remaining = targetCount - 1;
  let groupIndex = 0;
  while (remaining > 0) {
    const leafCount = Math.min(64, remaining - 1);
    metadata[`group-${String(groupIndex)}`] = Object.fromEntries(
      Array.from({ length: leafCount }, (_, index) => [`leaf-${String(index)}`, index]),
    );
    remaining -= leafCount + 1;
    groupIndex += 1;
  }
  return metadata;
}

describe("error log metadata budget", () => {
  it("pins the approved operational limits independently from production constants", () => {
    expect(ERROR_LOG_METADATA_TRUNCATED_KEY).toBe("__lighthouseTruncated");
    expect(ERROR_LOG_METADATA_LIMITS).toEqual({
      maxArrayItems: 32,
      maxDepth: 4,
      maxJsonBytes: 16_384,
      maxKeyLength: 160,
      maxObjectKeys: 64,
      maxStringLength: 2_048,
      maxVisitedNodes: 512,
    });
  });

  it("preserves small JSON-compatible metadata while removing null characters", () => {
    expect(
      sanitizeErrorLogMetadata({
        count: 3,
        nested: { ok: true },
        source: "client\u0000-error",
      }),
    ).toEqual({
      count: 3,
      nested: { ok: true },
      source: "client-error",
    });
  });

  it("preserves prototype-shaped JSON keys as safe own properties", () => {
    const metadata = JSON.parse('{"__proto__":{"polluted":true},"safe":"x"}') as Record<
      string,
      unknown
    >;

    const result = sanitizeErrorLogMetadata(metadata);

    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(result.__proto__).toEqual({ polluted: true });
    expect(result.safe).toBe("x");
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it("reserves the truncation marker namespace for server-owned state", () => {
    expect(
      sanitizeErrorLogMetadata({
        [ERROR_LOG_METADATA_TRUNCATED_KEY]: "client-supplied",
        safe: "x",
      }),
    ).toEqual({ safe: "x", [ERROR_LOG_METADATA_TRUNCATED_KEY]: true });
  });

  it("reserves only the top-level marker and preserves nested diagnostic fields", () => {
    expect(
      sanitizeErrorLogMetadata({
        nested: { [ERROR_LOG_METADATA_TRUNCATED_KEY]: "diagnostic", safe: "x" },
      }),
    ).toEqual({
      nested: { [ERROR_LOG_METADATA_TRUNCATED_KEY]: "diagnostic", safe: "x" },
    });
  });

  it("distinguishes each exact valid boundary from its first overflow", () => {
    const validDepth = { level1: { level2: { level3: { value: "ok" } } } };
    const overflowDepth = { level1: { level2: { level3: { level4: { value: "hidden" } } } } };
    const validObject = Object.fromEntries(
      Array.from({ length: 64 }, (_, index) => [`key-${String(index)}`, index]),
    );
    const overflowObject = { ...validObject, overflow: true };

    expect(sanitizeErrorLogMetadata({ value: "x".repeat(2_048) })).not.toHaveProperty(
      "__lighthouseTruncated",
    );
    expect(sanitizeErrorLogMetadata({ value: "x".repeat(2_049) })).toHaveProperty(
      "__lighthouseTruncated",
      true,
    );
    expect(
      sanitizeErrorLogMetadata({ value: Array.from({ length: 32 }, () => 1) }),
    ).not.toHaveProperty("__lighthouseTruncated");
    expect(sanitizeErrorLogMetadata({ value: Array.from({ length: 33 }, () => 1) })).toHaveProperty(
      "__lighthouseTruncated",
      true,
    );
    expect(sanitizeErrorLogMetadata(validDepth)).not.toHaveProperty("__lighthouseTruncated");
    expect(sanitizeErrorLogMetadata(overflowDepth)).toHaveProperty("__lighthouseTruncated", true);
    expect(sanitizeErrorLogMetadata(validObject)).not.toHaveProperty("__lighthouseTruncated");
    expect(sanitizeErrorLogMetadata(overflowObject)).toHaveProperty("__lighthouseTruncated", true);

    const validBytes = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [`key-${String(index)}`, "x".repeat(2_048)]),
    );
    const overflowBytes = { ...validBytes, overflow: "x".repeat(2_048) };
    expect(sanitizeErrorLogMetadata(validBytes)).not.toHaveProperty("__lighthouseTruncated");
    expect(sanitizeErrorLogMetadata(overflowBytes)).toHaveProperty("__lighthouseTruncated", true);

    expect(sanitizeErrorLogMetadata(metadataWithExactJsonBytes(16_384))).not.toHaveProperty(
      "__lighthouseTruncated",
    );
    expect(sanitizeErrorLogMetadata(metadataWithExactJsonBytes(16_385))).toHaveProperty(
      "__lighthouseTruncated",
      true,
    );

    expect(sanitizeErrorLogMetadata(metadataWithVisitedValueCount(512))).not.toHaveProperty(
      "__lighthouseTruncated",
    );
    expect(sanitizeErrorLogMetadata(metadataWithVisitedValueCount(513))).toHaveProperty(
      "__lighthouseTruncated",
      true,
    );
  });

  it("bounds nested depth, strings, arrays, keys, and object cardinality", () => {
    const longKey = "k".repeat(ERROR_LOG_METADATA_LIMITS.maxKeyLength + 10);
    const metadata: Record<string, unknown> = {
      long: "x".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength + 10),
      items: Array.from(
        { length: ERROR_LOG_METADATA_LIMITS.maxArrayItems + 10 },
        (_, index) => index,
      ),
      deep: { a: { b: { c: { d: "hidden" } } } },
      [longKey]: "value",
      ...Object.fromEntries(
        Array.from({ length: ERROR_LOG_METADATA_LIMITS.maxObjectKeys + 8 }, (_, index) => [
          `key-${String(index)}`,
          index,
        ]),
      ),
    };

    const result = sanitizeErrorLogMetadata(metadata);

    expect(Object.keys(result)).toHaveLength(ERROR_LOG_METADATA_LIMITS.maxObjectKeys);
    expect(result).toHaveProperty("__lighthouseTruncated", true);
    expect(result.long).toBe("x".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength));
    expect(result.items).toHaveLength(ERROR_LOG_METADATA_LIMITS.maxArrayItems);
    expect(result.items).toEqual(expect.arrayContaining(["[truncated]"]));
    expect(result.deep).toEqual({ a: { b: { c: "[truncated]" } } });
    expect(result[longKey.slice(0, ERROR_LOG_METADATA_LIMITS.maxKeyLength)]).toBe("value");
  });

  it("keeps the final UTF-8 JSON representation inside the byte ceiling", () => {
    const metadata = Object.fromEntries(
      Array.from({ length: 24 }, (_, index) => [
        `한글-${String(index)}`,
        "한".repeat(ERROR_LOG_METADATA_LIMITS.maxStringLength),
      ]),
    );

    const first = sanitizeErrorLogMetadata(metadata);
    const second = sanitizeErrorLogMetadata(metadata);

    expect(first).toEqual(second);
    expect(first).toHaveProperty("__lighthouseTruncated", true);
    expect(metadataBytes(first)).toBeLessThanOrEqual(ERROR_LOG_METADATA_LIMITS.maxJsonBytes);
  });

  it("terminates cyclic internal metadata at the same depth boundary", () => {
    const cyclic: Record<string, unknown> = { source: "server" };
    cyclic.self = cyclic;

    const result = sanitizeErrorLogMetadata(cyclic);

    expect(result).toHaveProperty("__lighthouseTruncated", true);
    expect(metadataBytes(result)).toBeLessThanOrEqual(ERROR_LOG_METADATA_LIMITS.maxJsonBytes);
    expect(JSON.stringify(result)).toContain("[truncated]");
  });

  it("bounds total traversal work for a wide direct-caller object graph", () => {
    let propertyReads = 0;
    function createWideNode(remainingDepth: number): Record<string, unknown> {
      const node: Record<string, unknown> = {};
      for (let index = 0; index < 16; index += 1) {
        Object.defineProperty(node, `key-${String(index)}`, {
          enumerable: true,
          get() {
            propertyReads += 1;
            return remainingDepth > 1 ? createWideNode(remainingDepth - 1) : "leaf";
          },
        });
      }
      return node;
    }

    const result = sanitizeErrorLogMetadata(createWideNode(4));

    expect(propertyReads).toBeLessThanOrEqual(511);
    expect(result).toHaveProperty("__lighthouseTruncated", true);
    expect(metadataBytes(result)).toBeLessThanOrEqual(16_384);
  });
});

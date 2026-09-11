import { describe, expect, it } from "vitest";
import { ERROR_CATALOG } from "@/app/domain/error-catalog";
import { t, type MessageKey } from "@/app/i18n/message-access";

describe("Error Catalog message keys", () => {
  it("keeps every catalog entry inside the compiler-owned message key space", () => {
    const messageKeys: MessageKey[] = Object.values(ERROR_CATALOG).map((entry) => entry.messageKey);

    expect(messageKeys).toHaveLength(13);
    for (const messageKey of messageKeys) {
      expect(t(messageKey)).toEqual(expect.any(String));
    }
  });

  it("fails deterministically for an invalid dynamic key before parameter replacement", () => {
    const invalidKey = "catalog.error.missing" as MessageKey;

    expect(() => t(invalidKey)).toThrow("Unknown message key: catalog.error.missing");
    expect(() => t(invalidKey, { param: "value" })).toThrow(
      "Unknown message key: catalog.error.missing",
    );
  });
});

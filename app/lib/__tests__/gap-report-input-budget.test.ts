import { describe, expect, it } from "vitest";
import {
  GAP_REPORT_REQUEST_MAX_BYTES,
  GapReportRequestBudgetError,
  serializeGapReportRequest,
  truncateUtf8,
  utf8ByteLength,
} from "@/app/lib/gap-report-input-budget";

describe("gap report serialized input budget", () => {
  it("truncates at a complete UTF-8 code point", () => {
    expect(truncateUtf8("가나다", 7)).toBe("가나");
    expect(utf8ByteLength(truncateUtf8("가나다", 7))).toBeLessThanOrEqual(7);
  });

  it("accepts the exact byte ceiling and rejects the first byte above it", () => {
    const exactPayload = "x".repeat(GAP_REPORT_REQUEST_MAX_BYTES - 2);
    expect(utf8ByteLength(serializeGapReportRequest(exactPayload))).toBe(
      GAP_REPORT_REQUEST_MAX_BYTES,
    );

    expect(() => serializeGapReportRequest(`${exactPayload}x`)).toThrow(
      GapReportRequestBudgetError,
    );
  });
});

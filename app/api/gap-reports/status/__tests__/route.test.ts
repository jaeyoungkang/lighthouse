import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const GAP_REPORT_ID = "00000000-0000-4000-8000-000000000001";
const { findGapNetworkView } = vi.hoisted(() => ({
  findGapNetworkView: vi.fn(),
}));

vi.mock("@/app/server/domain-access/gap-report-access", () => ({ findGapNetworkView }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("gap report status authentication", () => {
  it("does not expose shared report status to an unauthenticated request", async () => {
    const { UnauthenticatedError } = await import("@/app/server/auth/auth-errors");
    findGapNetworkView.mockRejectedValue(new UnauthenticatedError());
    const { GET } = await import("../route");
    const response = await GET(
      new NextRequest(`https://example.com/api/gap-reports/status?gapReportId=${GAP_REPORT_ID}`),
    );

    expect(response.status).toBe(401);
    expect(findGapNetworkView).toHaveBeenCalledWith(GAP_REPORT_ID);
  });
});

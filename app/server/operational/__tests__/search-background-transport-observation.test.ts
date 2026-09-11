import { describe, expect, it, vi } from "vitest";
import { observeSearchBackgroundTransport } from "@/app/server/operational/search-background-transport-observation";

describe("search background transport observation", () => {
  it("never lets a telemetry sink failure affect the product request", () => {
    const sink = vi.fn(() => {
      throw new Error("telemetry unavailable");
    });

    expect(() => {
      observeSearchBackgroundTransport("enrichment", "v1", sink);
    }).not.toThrow();
    expect(sink).toHaveBeenCalledWith("[search-background-transport]", {
      route: "enrichment",
      transportVersion: "v1",
    });
  });
});

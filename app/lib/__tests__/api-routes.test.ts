import { describe, expect, it } from "vitest";
import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";

describe("buildSearchRoutePageRoute", () => {
  it("serializes search facet filters as URL query state", () => {
    const result = buildSearchRoutePageRoute({
      q: "the ai scientist",
      sort: "relevance",
      year: "2020-2026",
      facetFilters: {
        fieldsOfStudy: ["Computer Science"],
        authors: ["R. Lange"],
        venues: ["arXiv.org"],
        hasPdf: true,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = result.route;
    const parsed = new URL(`https://example.test${url}`);

    expect(parsed.pathname).toBe("/search");
    expect(parsed.searchParams.get("q")).toBe("the ai scientist");
    expect(parsed.searchParams.get("sort")).toBeNull();
    expect(parsed.searchParams.get("year")).toBe("2020-2026");
    expect(parsed.searchParams.getAll("field")).toEqual(["Computer Science"]);
    expect(parsed.searchParams.getAll("author")).toEqual(["R. Lange"]);
    expect(parsed.searchParams.getAll("venue")).toEqual(["arXiv.org"]);
    expect(parsed.searchParams.get("hasPdf")).toBe("true");
  });

  it.each(["interest", "relevance"])(
    "omits the retired %s basis and personalize=true flag",
    (sort) => {
      expect(
        buildSearchRoutePageRoute({
          q: "agent memory",
          sort,
          personalize: true,
        }),
      ).toEqual({ ok: true, route: "/search?q=agent+memory" });
    },
  );
});

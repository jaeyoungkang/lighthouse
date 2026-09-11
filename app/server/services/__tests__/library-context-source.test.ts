import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  __resetLibraryContextCacheForTests,
  fetchMoonlightScholarLibraryPapers,
  getLibraryContextForUser,
  mapMoonlightLibraryPapersToContext,
  resolveLibraryContextForUser,
} from "@/app/server/services/library-context-source";

const { getMoonlightScholarSessionTokenFromCookiesMock, verifyMoonlightScholarTokenMock } =
  vi.hoisted(() => ({
    getMoonlightScholarSessionTokenFromCookiesMock: vi.fn<() => Promise<string | null>>(),
    verifyMoonlightScholarTokenMock:
      vi.fn<(token: string | null | undefined) => { id: string; email: string }>(),
  }));

vi.mock("@/app/server/auth/moonlight-scholar-token", () => ({
  getMoonlightScholarSessionTokenFromCookies: getMoonlightScholarSessionTokenFromCookiesMock,
  verifyMoonlightScholarToken: verifyMoonlightScholarTokenMock,
}));

const ORIGINAL_PATH = process.env.LIBRARY_CONTEXT_PILOT_PATH;
const ORIGINAL_JSON = process.env.LIBRARY_CONTEXT_JSON;
const ORIGINAL_LIBRARY_GROUNDING_ENABLED = process.env.LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED;
const ORIGINAL_MOONLIGHT_SCHOLAR_API_BASE_URL = process.env.MOONLIGHT_SCHOLAR_API_BASE_URL;
const ORIGINAL_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL =
  process.env.NEXT_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL;
const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "library-context-"));
  process.env.LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED = "1";
  getMoonlightScholarSessionTokenFromCookiesMock.mockReset();
  getMoonlightScholarSessionTokenFromCookiesMock.mockResolvedValue(null);
  verifyMoonlightScholarTokenMock.mockReset();
  verifyMoonlightScholarTokenMock.mockReturnValue({
    id: "moonlight-user-1",
    email: "tester@corca.ai",
  });
  __resetLibraryContextCacheForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  if (ORIGINAL_PATH === undefined) delete process.env.LIBRARY_CONTEXT_PILOT_PATH;
  else process.env.LIBRARY_CONTEXT_PILOT_PATH = ORIGINAL_PATH;
  if (ORIGINAL_JSON === undefined) delete process.env.LIBRARY_CONTEXT_JSON;
  else process.env.LIBRARY_CONTEXT_JSON = ORIGINAL_JSON;
  if (ORIGINAL_LIBRARY_GROUNDING_ENABLED === undefined) {
    delete process.env.LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED;
  } else {
    process.env.LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED = ORIGINAL_LIBRARY_GROUNDING_ENABLED;
  }
  if (ORIGINAL_MOONLIGHT_SCHOLAR_API_BASE_URL === undefined) {
    delete process.env.MOONLIGHT_SCHOLAR_API_BASE_URL;
  } else {
    process.env.MOONLIGHT_SCHOLAR_API_BASE_URL = ORIGINAL_MOONLIGHT_SCHOLAR_API_BASE_URL;
  }
  if (ORIGINAL_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL =
      ORIGINAL_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL;
  }
  process.chdir(ORIGINAL_CWD);
  __resetLibraryContextCacheForTests();
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

function useFixture(contents: unknown): void {
  const path = join(dir, "library-context.json");
  writeFileSync(path, JSON.stringify(contents), "utf8");
  process.env.LIBRARY_CONTEXT_PILOT_PATH = path;
  __resetLibraryContextCacheForTests();
}

describe("getLibraryContextForUser", () => {
  it("uses internal reviewed_papers as the default library context when external grounding is disabled", async () => {
    delete process.env.LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED;
    const resolution = await resolveLibraryContextForUser("tester@corca.ai", {
      reviewedPapers: [
        {
          paperId: "101",
          title: "Internal Paper",
        },
        {
          paperId: "non-corpus-id",
          title: "External Identifier",
        },
        {
          paperId: "pap_e3_only",
          title: "Canonical E3 Paper",
        },
      ],
    });

    expect(resolution.accessStatus).toBe("available");
    expect(resolution.context?.folders).toEqual([
      {
        name: "내 라이브러리",
        anchorCorpusIds: ["101", "pap_e3_only"],
        anchorPapers: [
          { paperId: "101", title: "Internal Paper" },
          { paperId: "pap_e3_only", title: "Canonical E3 Paper" },
        ],
      },
    ]);
    expect(resolution.context?.neighborhood).toEqual({});
    expect(getMoonlightScholarSessionTokenFromCookiesMock).not.toHaveBeenCalled();
  });
});

describe("getLibraryContextForUser compatibility sources", () => {
  it("returns unavailable by default when library grounding is disabled", async () => {
    delete process.env.LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED;

    useFixture({
      "tester@corca.ai": {
        folders: [{ name: "표현학습", anchorCorpusIds: ["1"] }],
        neighborhood: { "10": 3000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });

    await expect(resolveLibraryContextForUser("tester@corca.ai")).resolves.toEqual({
      context: null,
      accessStatus: "unavailable",
    });
    expect(getMoonlightScholarSessionTokenFromCookiesMock).not.toHaveBeenCalled();
  });

  it("loads library context for a cohort email", async () => {
    useFixture({
      "tester@corca.ai": {
        folders: [{ name: "표현학습", anchorCorpusIds: ["1"] }],
        neighborhood: { "10": 3000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });

    // Lookup is normalized (trim + lowercase), matching how the runtime hands
    // over `user.email`.
    const ctx = await getLibraryContextForUser("  Tester@Corca.ai ");
    expect(ctx).not.toBeNull();
    expect(ctx?.neighborhood).toEqual({ "10": 3000 });
    expect(ctx?.folders[0]?.name).toBe("표현학습");
  });

  it("returns null when the email is absent or the file is missing or malformed", async () => {
    // No email.
    await expect(getLibraryContextForUser(undefined)).resolves.toBeNull();
    await expect(getLibraryContextForUser("")).resolves.toBeNull();

    // File missing.
    process.env.LIBRARY_CONTEXT_PILOT_PATH = join(dir, "does-not-exist.json");
    __resetLibraryContextCacheForTests();
    await expect(getLibraryContextForUser("tester@corca.ai")).resolves.toBeNull();

    // Email not in the cohort map.
    useFixture({
      "other@corca.ai": { folders: [], neighborhood: {}, computedAt: "2026-05-30T00:00:00Z" },
    });
    await expect(getLibraryContextForUser("tester@corca.ai")).resolves.toBeNull();

    // Malformed JSON.
    const badPath = join(dir, "library-context.json");
    writeFileSync(badPath, "{ not valid json", "utf8");
    process.env.LIBRARY_CONTEXT_PILOT_PATH = badPath;
    __resetLibraryContextCacheForTests();
    await expect(getLibraryContextForUser("tester@corca.ai")).resolves.toBeNull();
  });

  it("reloads the local pilot file after an initial missing-file lookup", async () => {
    const latePath = join(dir, "late-library-context.json");
    process.env.LIBRARY_CONTEXT_PILOT_PATH = latePath;

    await expect(getLibraryContextForUser("tester@corca.ai")).resolves.toBeNull();

    writeFileSync(
      latePath,
      JSON.stringify({
        "tester@corca.ai": {
          folders: [{ name: "표현학습", anchorCorpusIds: ["1"] }],
          neighborhood: { "10": 3000 },
          computedAt: "2026-05-30T00:00:00Z",
        },
      }),
      "utf8",
    );

    const ctx = await getLibraryContextForUser("tester@corca.ai");
    expect(ctx).not.toBeNull();
    expect(ctx?.folders[0]?.anchorCorpusIds).toEqual(["1"]);
  });

  it("reloads same-size pilot file rewrites when the mtime does not change", async () => {
    const path = join(dir, "library-context.json");
    const first = JSON.stringify({
      "tester@corca.ai": {
        folders: [{ name: "First", anchorCorpusIds: ["1"] }],
        neighborhood: { "10": 3000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    const second = JSON.stringify({
      "tester@corca.ai": {
        folders: [{ name: "Later", anchorCorpusIds: ["2"] }],
        neighborhood: { "20": 4000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    expect(second.length).toBe(first.length);
    const fixedTime = new Date("2026-05-30T00:00:00Z");
    writeFileSync(path, first, "utf8");
    utimesSync(path, fixedTime, fixedTime);
    process.env.LIBRARY_CONTEXT_PILOT_PATH = path;
    __resetLibraryContextCacheForTests();
    const initialStat = statSync(path);

    expect((await getLibraryContextForUser("tester@corca.ai"))?.folders[0]?.name).toBe("First");

    writeFileSync(path, second, "utf8");
    utimesSync(path, fixedTime, fixedTime);
    const rewrittenStat = statSync(path);
    expect(rewrittenStat.size).toBe(initialStat.size);
    expect(rewrittenStat.mtimeMs).toBe(initialStat.mtimeMs);

    const ctx = await getLibraryContextForUser("tester@corca.ai");
    expect(ctx?.folders[0]?.name).toBe("Later");
    expect(ctx?.folders[0]?.anchorCorpusIds).toEqual(["2"]);
  });

  it("degrades to null when the nested context shape is malformed", async () => {
    // Folder element missing anchorCorpusIds.
    useFixture({
      "tester@corca.ai": {
        folders: [{ name: "표현학습" }],
        neighborhood: { "10": 3000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    await expect(getLibraryContextForUser("tester@corca.ai")).resolves.toBeNull();

    // anchorCorpusIds not all strings.
    useFixture({
      "tester@corca.ai": {
        folders: [{ name: "표현학습", anchorCorpusIds: [1, 2] }],
        neighborhood: { "10": 3000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    await expect(getLibraryContextForUser("tester@corca.ai")).resolves.toBeNull();

    // Neighborhood weight is not a number.
    useFixture({
      "tester@corca.ai": {
        folders: [{ name: "표현학습", anchorCorpusIds: ["1"] }],
        neighborhood: { "10": "high" },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    await expect(getLibraryContextForUser("tester@corca.ai")).resolves.toBeNull();
  });

  it("loads from the LIBRARY_CONTEXT_JSON env var, taking precedence over the file", async () => {
    // Point the file at something that would NOT match, to prove env wins.
    useFixture({
      "other@corca.ai": { folders: [], neighborhood: {}, computedAt: "2026-05-30T00:00:00Z" },
    });
    process.env.LIBRARY_CONTEXT_JSON = JSON.stringify({
      "tester@corca.ai": {
        folders: [{ name: "표현학습", anchorCorpusIds: ["1"] }],
        neighborhood: { "10": 3000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    __resetLibraryContextCacheForTests();

    const ctx = await getLibraryContextForUser("tester@corca.ai");
    expect(ctx).not.toBeNull();
    expect(ctx?.neighborhood).toEqual({ "10": 3000 });
  });

  it("does not read the default pilot file during production builds", async () => {
    const pilotDir = join(dir, "pilot");
    mkdirSync(pilotDir);
    writeFileSync(
      join(pilotDir, "library-context.json"),
      JSON.stringify({
        "tester@corca.ai": {
          folders: [{ name: "Should stay build-invisible", anchorCorpusIds: ["1"] }],
          neighborhood: { "10": 3000 },
          computedAt: "2026-05-30T00:00:00Z",
        },
      }),
      "utf8",
    );
    process.chdir(dir);
    delete process.env.LIBRARY_CONTEXT_PILOT_PATH;
    delete process.env.LIBRARY_CONTEXT_JSON;
    vi.stubEnv("NODE_ENV", "production");
    __resetLibraryContextCacheForTests();

    await expect(getLibraryContextForUser("tester@corca.ai")).resolves.toBeNull();

    process.env.LIBRARY_CONTEXT_PILOT_PATH = join(pilotDir, "library-context.json");
    __resetLibraryContextCacheForTests();

    const ctx = await getLibraryContextForUser("tester@corca.ai");
    expect(ctx?.folders[0]?.name).toBe("Should stay build-invisible");
  });

  it("accepts optional anchor paper display titles in the precomputed context", async () => {
    useFixture({
      "tester@corca.ai": {
        folders: [
          {
            name: "표현학습",
            anchorCorpusIds: ["1"],
            anchorPapers: [{ paperId: "1", title: "Attention Is All You Need" }],
          },
        ],
        neighborhood: { "10": 3000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });

    const ctx = await getLibraryContextForUser("tester@corca.ai");
    expect(ctx?.folders[0]?.anchorPapers?.[0]?.title).toBe("Attention Is All You Need");
  });
});

describe("resolveLibraryContextForUser live Moonlight degrade", () => {
  it("surfaces Moonlight Scholar allowlist denial without falling back to static context", async () => {
    process.env.MOONLIGHT_SCHOLAR_API_BASE_URL = "https://api.themoonlight.io";
    getMoonlightScholarSessionTokenFromCookiesMock.mockResolvedValue("scholar-token");
    useFixture({
      "tester@corca.ai": {
        folders: [{ name: "표현학습", anchorCorpusIds: ["1"] }],
        neighborhood: { "10": 3000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            error: { code: "MOONLIGHT_SCHOLAR_ACCESS_NOT_ALLOWED" },
          },
          403,
        ),
      ),
    );

    await expect(resolveLibraryContextForUser("tester@corca.ai")).resolves.toEqual({
      context: null,
      accessStatus: "moonlight_scholar_access_not_allowed",
    });
  });

  it("surfaces Moonlight Scholar allowlist denial when the API returns a bare 403", async () => {
    process.env.MOONLIGHT_SCHOLAR_API_BASE_URL = "https://api.themoonlight.io";
    getMoonlightScholarSessionTokenFromCookiesMock.mockResolvedValue("scholar-token");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })),
    );

    await expect(resolveLibraryContextForUser("tester@corca.ai")).resolves.toEqual({
      context: null,
      accessStatus: "moonlight_scholar_access_not_allowed",
    });
  });

  it("does not use static fallback when the live Moonlight API fails", async () => {
    process.env.MOONLIGHT_SCHOLAR_API_BASE_URL = "https://api.themoonlight.io";
    getMoonlightScholarSessionTokenFromCookiesMock.mockResolvedValue("scholar-token");
    useFixture({
      "tester@corca.ai": {
        folders: [{ name: "표현학습", anchorCorpusIds: ["1"] }],
        neighborhood: { "10": 3000 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await expect(resolveLibraryContextForUser("tester@corca.ai")).resolves.toEqual({
      context: null,
      accessStatus: "unavailable",
    });
  });

  it("bounds a stalled live Moonlight library API request", async () => {
    vi.useFakeTimers();
    process.env.MOONLIGHT_SCHOLAR_API_BASE_URL = "https://api.themoonlight.io";
    getMoonlightScholarSessionTokenFromCookiesMock.mockResolvedValue("scholar-token");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      ),
    );

    const resolutionPromise = resolveLibraryContextForUser("tester@corca.ai");
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(resolutionPromise).resolves.toEqual({
      context: null,
      accessStatus: "unavailable",
    });
  });

  it("rejects a Moonlight library token for a different resolved user email", async () => {
    process.env.MOONLIGHT_SCHOLAR_API_BASE_URL = "https://api.themoonlight.io";
    getMoonlightScholarSessionTokenFromCookiesMock.mockResolvedValue("scholar-token");
    useFixture({
      "tester@corca.ai": {
        folders: [{ name: "stale local folder", anchorCorpusIds: ["999"] }],
        neighborhood: { "999": 99 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    verifyMoonlightScholarTokenMock.mockReturnValue({
      id: "moonlight-user-2",
      email: "other@corca.ai",
    });
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveLibraryContextForUser("tester@corca.ai")).resolves.toEqual({
      context: null,
      accessStatus: "moonlight_scholar_session_invalid",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("resolveLibraryContextForUser source precedence", () => {
  it("uses the live Moonlight library source before any static compatibility context", async () => {
    process.env.MOONLIGHT_SCHOLAR_API_BASE_URL = "https://api.themoonlight.io";
    getMoonlightScholarSessionTokenFromCookiesMock.mockResolvedValue("scholar-token");
    useFixture({
      "tester@corca.ai": {
        folders: [{ name: "stale local folder", anchorCorpusIds: ["999"] }],
        neighborhood: { "999": 99 },
        computedAt: "2026-05-30T00:00:00Z",
      },
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        papers: [
          {
            title: "Fresh Moonlight Paper",
            identifiers: { corpusId: "101" },
            tags: ["Fresh Folder"],
          },
        ],
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resolution = await resolveLibraryContextForUser("tester@corca.ai");

    expect(resolution.accessStatus).toBe("available");
    expect(resolution.context?.folders).toEqual([
      {
        name: "Fresh Folder",
        anchorCorpusIds: ["101"],
        anchorPapers: [{ paperId: "101", title: "Fresh Moonlight Paper" }],
      },
    ]);
    expect(resolution.context?.neighborhood).toEqual({});
    expect(typeof resolution.context?.computedAt).toBe("string");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Moonlight Scholar library context mapping", () => {
  it("maps marked library papers to corpus-id anchors grouped by tags", () => {
    const ctx = mapMoonlightLibraryPapersToContext(
      [
        {
          title: "Clinical Retrieval",
          identifiers: { corpusId: 101 },
          tags: ["Medical AI", "Retrieval"],
        },
        {
          title: "Missing corpus id",
          identifiers: {},
          tags: ["Medical AI"],
        },
        {
          title: "Graph RAG",
          identifiers: { corpusId: "202" },
          tags: [],
        },
      ],
      "2026-06-28T00:00:00.000Z",
    );

    expect(ctx).toEqual({
      folders: [
        {
          name: "Medical AI",
          anchorCorpusIds: ["101"],
          anchorPapers: [{ paperId: "101", title: "Clinical Retrieval" }],
        },
        {
          name: "Moonlight Library",
          anchorCorpusIds: ["202"],
          anchorPapers: [{ paperId: "202", title: "Graph RAG" }],
        },
        {
          name: "Retrieval",
          anchorCorpusIds: ["101"],
          anchorPapers: [{ paperId: "101", title: "Clinical Retrieval" }],
        },
      ],
      neighborhood: {},
      computedAt: "2026-06-28T00:00:00.000Z",
    });
  });

  it("paginates the Moonlight Scholar library API with the bearer token", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Paper 1", identifiers: { corpusId: "101" }, tags: [] }],
          nextCursor: "cursor-2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Paper 2", identifiers: { corpusId: "202" }, tags: [] }],
          nextCursor: null,
        }),
      );

    const papers = await fetchMoonlightScholarLibraryPapers({
      baseUrl: "https://api.themoonlight.io",
      token: "scholar-token",
      fetchImpl: fetchMock,
    });

    expect(papers).toHaveLength(2);
    expect(fetchRequestUrl(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.themoonlight.io/api/moonlight-scholar/library-papers?limit=100",
    );
    expect(fetchRequestUrl(fetchMock.mock.calls[1]?.[0])).toBe(
      "https://api.themoonlight.io/api/moonlight-scholar/library-papers?limit=100&cursor=cursor-2",
    );
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      authorization: "Bearer scholar-token",
    });
  });

  it("drops an invalid cursor once and restarts pagination from the first page", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Stale page", identifiers: { corpusId: "101" }, tags: [] }],
          nextCursor: "stale-cursor",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: { code: "MOONLIGHT_SCHOLAR_LIBRARY_CURSOR_INVALID" },
          },
          400,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Restarted page", identifiers: { corpusId: "202" }, tags: [] }],
          nextCursor: null,
        }),
      );

    const papers = await fetchMoonlightScholarLibraryPapers({
      baseUrl: "https://api.themoonlight.io",
      token: "scholar-token",
      fetchImpl: fetchMock,
    });

    expect(papers.map((paper) => paper.title)).toEqual(["Restarted page"]);
    expect(fetchRequestUrl(fetchMock.mock.calls[1]?.[0])).toBe(
      "https://api.themoonlight.io/api/moonlight-scholar/library-papers?limit=100&cursor=stale-cursor",
    );
    expect(fetchRequestUrl(fetchMock.mock.calls[2]?.[0])).toBe(
      "https://api.themoonlight.io/api/moonlight-scholar/library-papers?limit=100",
    );
  });

  it("continues pagination after restarting from an invalid cursor", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Stale page", identifiers: { corpusId: "101" }, tags: [] }],
          nextCursor: "cursor-2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: { code: "MOONLIGHT_SCHOLAR_LIBRARY_CURSOR_INVALID" },
          },
          400,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Restarted page", identifiers: { corpusId: "202" }, tags: [] }],
          nextCursor: "cursor-2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Restarted page 2", identifiers: { corpusId: "303" }, tags: [] }],
          nextCursor: null,
        }),
      );

    const papers = await fetchMoonlightScholarLibraryPapers({
      baseUrl: "https://api.themoonlight.io",
      token: "scholar-token",
      fetchImpl: fetchMock,
    });

    expect(papers.map((paper) => paper.title)).toEqual(["Restarted page", "Restarted page 2"]);
    expect(fetchRequestUrl(fetchMock.mock.calls[2]?.[0])).toBe(
      "https://api.themoonlight.io/api/moonlight-scholar/library-papers?limit=100",
    );
    expect(fetchRequestUrl(fetchMock.mock.calls[3]?.[0])).toBe(
      "https://api.themoonlight.io/api/moonlight-scholar/library-papers?limit=100&cursor=cursor-2",
    );
  });

  it("does not restart pagination for a generic 400 on a cursor page", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Page 1", identifiers: { corpusId: "101" }, tags: [] }],
          nextCursor: "cursor-2",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: { code: "OTHER_BAD_REQUEST" } }, 400));

    await expect(
      fetchMoonlightScholarLibraryPapers({
        baseUrl: "https://api.themoonlight.io",
        token: "scholar-token",
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("Moonlight Scholar library request failed with 400.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops paginating when the Moonlight Scholar API repeats a cursor", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Page 1", identifiers: { corpusId: "101" }, tags: [] }],
          nextCursor: "cursor-2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          papers: [{ title: "Page 2", identifiers: { corpusId: "202" }, tags: [] }],
          nextCursor: "cursor-2",
        }),
      );

    const papers = await fetchMoonlightScholarLibraryPapers({
      baseUrl: "https://api.themoonlight.io",
      token: "scholar-token",
      fetchImpl: fetchMock,
    });

    expect(papers.map((paper) => paper.title)).toEqual(["Page 1", "Page 2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops paginating when the Moonlight Scholar API returns an empty cursor page", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        papers: [],
        nextCursor: "cursor-2",
      }),
    );

    const papers = await fetchMoonlightScholarLibraryPapers({
      baseUrl: "https://api.themoonlight.io",
      token: "scholar-token",
      fetchImpl: fetchMock,
    });

    expect(papers).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fetchRequestUrl(input: Parameters<typeof fetch>[0] | undefined): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  throw new Error("Expected fetch request URL.");
}

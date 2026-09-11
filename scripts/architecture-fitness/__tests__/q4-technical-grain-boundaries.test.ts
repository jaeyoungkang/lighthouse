import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  inspectTechnicalGrainSources,
  isHistoricalOwnerLayoutRevision,
  traceChangeFiles,
} from "../collect-q4-technical-grain.mjs";

const configuredTargetRoot = process.env.AF_Q4_TARGET_ROOT;
if (!configuredTargetRoot && process.env.AF_Q4_TRUSTED_HARNESS_ROOT) {
  throw new Error("AF_Q4_TARGET_ROOT is required by the trusted Q4 harness.");
}
const TARGET_ROOT = configuredTargetRoot ?? process.cwd();

async function readTreeFiles(relative = "app"): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const directory = path.join(TARGET_ROOT, relative);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const ref = path.join(relative, entry.name).split(path.sep).join("/");
    if (entry.isDirectory()) {
      Object.assign(files, await readTreeFiles(ref));
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files[ref] = await readFile(path.join(TARGET_ROOT, ref), "utf8");
    }
  }
  return files;
}

const cleanGuards = {
  externalHttp: 0,
  aiGateway: 0,
  repositorySeam: 0,
  leastAuthority: 0,
};

type TechnicalGrainSeam = {
  seamRef: string;
  chokepointRefs: string[];
  responsibilityRefs: string[];
  callerRefs: string[];
  invariantRefs: string[];
  bypassRefs: string[];
};

function inspectSeams(
  files: Record<string, string>,
  guards: Record<string, number>,
): TechnicalGrainSeam[] {
  return inspectTechnicalGrainSources(files, guards) as unknown as TechnicalGrainSeam[];
}

describe("Q4 technical-grain trusted inventory", () => {
  it("observes the four approved target seams without bypasses", async () => {
    const seams = inspectSeams(await readTreeFiles(), cleanGuards);

    expect(seams.map((item) => item.seamRef)).toEqual([
      "seam:episteme-provider-gateway",
      "seam:structured-ai-gateway",
      "seam:reviewed-paper-domain-repository",
      "seam:client-background-server-effect",
    ]);
    for (const seam of seams) {
      expect(seam.chokepointRefs.length).toBeGreaterThan(0);
      expect(seam.responsibilityRefs.length).toBeGreaterThan(0);
      expect(seam.invariantRefs.length).toBeGreaterThan(0);
      expect(seam.bypassRefs).toEqual([]);
    }
  });

  it("rejects an undeclared literature gateway caller", async () => {
    const files = await readTreeFiles();
    files["app/server/services/q4-bypass.ts"] =
      'import { epistemeFetch } from "@/app/server/external-http-gateway/literature-provider-fetch";\n' +
      "export const bypass = epistemeFetch;\n";

    const provider = inspectSeams(files, cleanGuards)[0];
    expect(provider.bypassRefs).toEqual([
      "bypass:raw-literature-http:app/server/services/q4-bypass.ts",
    ]);
  });

  it("requires Episteme request metadata and the bounded cold-connect retry owner", async () => {
    const files = await readTreeFiles();
    const providerRef = "app/server/external-http-gateway/literature-provider-fetch.ts";
    const provider = inspectSeams(files, cleanGuards)[0];

    expect(provider.responsibilityRefs).toContain("responsibility:request-metadata");
    expect(provider.responsibilityRefs).toContain("responsibility:bounded-connect-retry");

    files[providerRef] = files[providerRef].replaceAll(
      "shouldRetryEpistemeConnectError",
      "q4RemovedConnectRetryOwner",
    );
    const withoutRetryOwner = inspectSeams(files, cleanGuards)[0];
    expect(withoutRetryOwner.responsibilityRefs).not.toContain(
      "responsibility:bounded-connect-retry",
    );
  });

  it("rejects a structured gateway that loses provider ownership", async () => {
    const files = await readTreeFiles();
    const gatewayRef = "app/server/ai-generation/gateway.ts";
    files[gatewayRef] = files[gatewayRef].replaceAll("generateText", "q4RemovedGenerateText");

    const ai = inspectSeams(files, cleanGuards)[1];
    expect(ai.chokepointRefs).not.toContain("chokepoint:structured-generation-gateway");
    expect(ai.invariantRefs).not.toContain("invariant:provider-effect-behind-ai-gateway");
  });

  it("resolves the judgment owner in current and exact-revision legacy layouts", async () => {
    const files = await readTreeFiles();
    const currentRef = "app/server/ai-generation/judgment.ts";
    const legacyRef = "app/lib/llm-judgment.ts";
    const judgment = files[currentRef] ?? files[legacyRef];
    expect(judgment).toBeDefined();

    const currentFiles = Object.fromEntries(
      Object.entries({ ...files, [currentRef]: judgment }).filter(([ref]) => ref !== legacyRef),
    );
    const currentAi = inspectSeams(currentFiles, cleanGuards)[1];

    const legacyFiles = Object.fromEntries(
      Object.entries({ ...files, [legacyRef]: judgment }).filter(([ref]) => ref !== currentRef),
    );
    const legacyAi = inspectSeams(legacyFiles, cleanGuards)[1];

    for (const ai of [currentAi, legacyAi]) {
      expect(ai.callerRefs).toContain("caller:execute-judgment");
      expect(ai.responsibilityRefs).toContain("responsibility:judgment-parse-fallback-ledger");
      expect(ai.bypassRefs).toEqual([]);
    }
  });

  it("opens historical owner compatibility only for definition-bound revisions", () => {
    expect(isHistoricalOwnerLayoutRevision("b9ba8c42b484e933860f591c807f7b6f56f7c543")).toBe(true);
    expect(isHistoricalOwnerLayoutRevision("e26b4ab8775a158c39c0090b2af6b7d480704d74")).toBe(true);
    expect(isHistoricalOwnerLayoutRevision("7b4a9a50bc021bcb41e63aa73093f66c9fe72cc8")).toBe(false);
  });

  it("rejects a legacy judgment owner that coexists with the current owner", async () => {
    const files = await readTreeFiles();
    const currentRef = "app/server/ai-generation/judgment.ts";
    const legacyRef = "app/lib/llm-judgment.ts";
    const judgment = files[currentRef] ?? files[legacyRef];
    expect(judgment).toBeDefined();

    files[currentRef] = judgment;
    files[legacyRef] = judgment;

    const ai = inspectSeams(files, cleanGuards)[1];
    expect(ai.bypassRefs).toEqual([`bypass:direct-ai-provider-acquisition:${legacyRef}`]);
  });

  it("turns repository and least-authority guard failures into explicit bypasses", async () => {
    const repository = inspectSeams(await readTreeFiles(), {
      ...cleanGuards,
      repositorySeam: 1,
      leastAuthority: 1,
    })[2];

    expect(repository.bypassRefs).toEqual([
      "bypass:repository-outside-raw-db",
      "bypass:route-or-service-to-repository",
    ]);
  });

  it("rejects an undeclared reviewed-paper repository importer", async () => {
    const files = await readTreeFiles();
    files["app/server/services/q4-reviewed-paper-bypass.ts"] =
      'import { listReviewedPapers } from "@/app/server/repository/reviewed-papers";\n' +
      "export const bypass = listReviewedPapers;\n";

    const repository = inspectSeams(files, cleanGuards)[2];
    expect(repository.bypassRefs).toContain(
      "bypass:route-or-service-to-repository:app/server/services/q4-reviewed-paper-bypass.ts",
    );
  });

  it("resolves a relative reviewed-paper import to the declared repository owner", async () => {
    const files = await readTreeFiles();
    const accessRef = "app/server/domain-access/reviewed-paper-access.ts";
    files[accessRef] = files[accessRef].replace(
      "@/app/server/repository/reviewed-papers",
      "../repository/reviewed-papers",
    );

    const repository = inspectSeams(files, cleanGuards)[2];
    expect(repository.callerRefs).toContain("caller:reviewed-paper-domain-access");
    expect(repository.bypassRefs).toEqual([]);
  });

  it("accepts imported call aliases while preserving their original owner symbols", async () => {
    const files = await readTreeFiles();
    const accessRef = "app/server/domain-access/reviewed-paper-access.ts";
    files[accessRef] = files[accessRef]
      .replace(
        "import { requireOwnerPrincipalAuth }",
        "import { requireOwnerPrincipalAuth as authenticateOwner }",
      )
      .replaceAll("requireOwnerPrincipalAuth()", "authenticateOwner()");

    const repository = inspectSeams(files, cleanGuards)[2];
    expect(repository.responsibilityRefs).toContain("responsibility:principal-and-product-action");
    expect(repository.invariantRefs).toContain("invariant:domain-access-owns-principal");
  });

  it("rejects a client background owner that imports server effects", async () => {
    const files = await readTreeFiles();
    const backgroundRef = "app/components/research/ResearchBackgroundTasks.tsx";
    files[backgroundRef] =
      'import "@/app/server/services/search-service";\n' + files[backgroundRef];

    const background = inspectSeams(files, cleanGuards)[3];
    expect(background.bypassRefs).toContain("bypass:client-imports-server");
    expect(background.responsibilityRefs).not.toContain("responsibility:server-auth-and-effect");
  });

  it("accepts exactly one current or legacy inline-analysis transport owner", async () => {
    const files = await readTreeFiles();
    const currentRef = "app/components/research/background-inline-analysis.ts";
    const legacyRef = "app/components/research-route-renderers/search-view.helpers.ts";
    const apiToken = "API_ROUTES.PAPERS_ANALYZE_INLINE";
    const currentSource = Object.hasOwn(files, currentRef) ? files[currentRef] : undefined;
    const legacySource = Object.hasOwn(files, legacyRef) ? files[legacyRef] : undefined;
    const transportSource = [currentRef, legacyRef]
      .filter((ref) => Object.hasOwn(files, ref))
      .map((ref) => files[ref])
      .find((source) => source.includes(apiToken));
    if (!transportSource) throw new Error("inline-analysis transport fixture is missing");
    const withoutTransport = (source: string | undefined) =>
      (source ?? "").replaceAll(apiToken, "q4RemovedInlineAnalysisRoute");

    const currentFiles = {
      ...files,
      [currentRef]: transportSource,
      [legacyRef]: withoutTransport(legacySource),
    };
    const currentBackground = inspectSeams(currentFiles, cleanGuards)[3];
    expect(currentBackground.responsibilityRefs).toContain("responsibility:server-auth-and-effect");

    const legacyFiles = {
      ...files,
      [currentRef]: withoutTransport(currentSource),
      [legacyRef]: transportSource,
    };
    const legacyBackground = inspectSeams(legacyFiles, cleanGuards)[3];
    expect(legacyBackground.responsibilityRefs).toContain("responsibility:server-auth-and-effect");
  });

  it("rejects simultaneous current and legacy inline-analysis transport owners", async () => {
    const files = await readTreeFiles();
    const currentRef = "app/components/research/background-inline-analysis.ts";
    const legacyRef = "app/components/research-route-renderers/search-view.helpers.ts";
    const apiToken = "API_ROUTES.PAPERS_ANALYZE_INLINE";
    const transportSource = [currentRef, legacyRef]
      .filter((ref) => Object.hasOwn(files, ref))
      .map((ref) => files[ref])
      .find((source) => source.includes(apiToken));
    if (!transportSource) throw new Error("inline-analysis transport fixture is missing");
    files[currentRef] = transportSource;
    files[legacyRef] = transportSource;

    const background = inspectSeams(files, cleanGuards)[3];
    expect(background.responsibilityRefs).not.toContain("responsibility:server-auth-and-effect");
    expect(background.invariantRefs).not.toContain("invariant:browser-lifetime-separated");
  });

  it("rejects a purpose route that loses its server guard", async () => {
    const files = await readTreeFiles();
    const routeRef = "app/api/search/enrichment/route.ts";
    files[routeRef] = files[routeRef].replace(
      "export const POST = withRouteGuard(",
      "export const POST = q4RemovedRouteGuard(",
    );
    files[routeRef] += "\n// export const POST = withRouteGuard(\n";

    const background = inspectSeams(files, cleanGuards)[3];
    expect(background.chokepointRefs).toContain("chokepoint:purpose-api-route");
    expect(background.responsibilityRefs).not.toContain("responsibility:server-auth-and-effect");
    expect(background.invariantRefs).not.toContain("invariant:browser-lifetime-separated");
  });

  it("rejects a locally rebound route-guard name", async () => {
    const files = await readTreeFiles();
    const routeRef = "app/api/search/enrichment/route.ts";
    files[routeRef] = files[routeRef].replace(
      'import { withRouteGuard } from "@/app/server/guards/route-guard";',
      'import { withRouteGuard as trustedRouteGuard } from "@/app/server/guards/route-guard";\n' +
        "const withRouteGuard = <T>(handler: T): T => handler;\n" +
        "void trustedRouteGuard;",
    );

    const background = inspectSeams(files, cleanGuards)[3];
    expect(background.responsibilityRefs).not.toContain("responsibility:server-auth-and-effect");
    expect(background.invariantRefs).not.toContain("invariant:browser-lifetime-separated");
  });

  it("accepts route-owned auth when the server effect owner consumes its carrier", async () => {
    const files = await readTreeFiles();
    const ownerRef = "app/server/domain-access/search-enrichment-access.ts";
    files[ownerRef] = files[ownerRef].replaceAll(
      "requireOwnerPrincipalAuth()",
      "q4RemovedOwnerAuth()",
    );
    files[ownerRef] += "\n// requireOwnerPrincipalAuth()\n";

    const background = inspectSeams(files, cleanGuards)[3];
    expect(background.chokepointRefs).toContain("chokepoint:purpose-api-route");
    expect(background.responsibilityRefs).toContain("responsibility:server-auth-and-effect");
    expect(background.invariantRefs).toContain("invariant:browser-lifetime-separated");
  });

  it("rejects a server effect path when both route and owner lose auth", async () => {
    const files = await readTreeFiles();
    const ownerRef = "app/server/domain-access/search-enrichment-access.ts";
    const routeRef = "app/api/search/enrichment/route.ts";
    files[ownerRef] = files[ownerRef].replaceAll(
      "requireOwnerPrincipalAuth()",
      "q4RemovedOwnerAuth()",
    );
    files[routeRef] = files[routeRef].replace(
      "requireOwnerPrincipalAuth()",
      "q4RemovedRouteAuth()",
    );

    const background = inspectSeams(files, cleanGuards)[3];
    expect(background.chokepointRefs).toContain("chokepoint:purpose-api-route");
    expect(background.responsibilityRefs).not.toContain("responsibility:server-auth-and-effect");
    expect(background.invariantRefs).not.toContain("invariant:browser-lifetime-separated");
  });

  it("keeps historical propagation scoped and exposes a missing required surface", () => {
    const incidentFiles = [
      "docs/incident-183-load-baseline.md",
      "docs/runtime-flows/search-mechanism.md",
      "app/server/external-http-gateway/literature-provider-fetch.ts",
      "app/server/external-http-gateway/episteme-circuit-breaker.ts",
      "app/server/services/episteme-literature.ts",
      "app/server/services/episteme-paper-neighborhood.ts",
      "app/server/external-http-gateway/__tests__/literature-provider-fetch.test.ts",
      "app/server/external-http-gateway/__tests__/episteme-circuit-breaker.test.ts",
      "scripts/quality/check-external-http-gateway.mjs",
      "docs/contracts/story-chain/promises/search-results-fast-window.md",
      "docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.md",
      "unrelated/co-committed-file.ts",
    ];
    const complete = traceChangeFiles("scenario:incident-183-release-contract", incidentFiles);
    expect(complete.propagationRefs).toHaveLength(6);
    expect(complete.scopedFiles).not.toContain("unrelated/co-committed-file.ts");

    const incomplete = traceChangeFiles(
      "scenario:incident-183-release-contract",
      incidentFiles.filter(
        (file) =>
          file !== "app/server/external-http-gateway/__tests__/episteme-circuit-breaker.test.ts",
      ),
    );
    expect(incomplete.propagationRefs).not.toContain("propagation:behavior-tests");
  });
});

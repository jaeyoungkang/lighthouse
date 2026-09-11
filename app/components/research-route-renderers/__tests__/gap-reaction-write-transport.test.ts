import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DefiniteGapReactionWriteError,
  persistGapReactionWithTransportRetry,
  UnconfirmedGapReactionWriteError,
} from "@/app/components/research-route-renderers/gap-reaction-write-transport";
import { createReactionReadyGapNetworkView } from "@/app/components/research-route-renderers/__tests__/gap-network-view-persistence.fixtures";

describe("gap reaction write transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the latest state and rebases a server 409 before issuing a new command", async () => {
    const current = {
      ...createReactionReadyGapNetworkView(),
      reactionVersion: 2,
    };
    const requested = current.metadata.reactionPreparation?.overviewReaction;
    if (!requested) throw new Error("prepared overview reaction is required");
    const confirmed = {
      ...current,
      reaction: requested,
      reactionVersion: 3,
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: "gap reaction version mismatch",
            code: "GAP_REACTION_VERSION_CONFLICT",
            action: "refresh-and-rebase",
            retryable: false,
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(Response.json(current))
      .mockResolvedValueOnce(Response.json(confirmed));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      persistGapReactionWithTransportRetry(
        {
          documentId: current.id,
          reaction: requested,
        },
        1,
      ),
    ).resolves.toEqual(confirmed);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual(["PUT", "GET", "PUT"]);
    const requestBody = fetchMock.mock.calls[2]?.[1]?.body;
    if (typeof requestBody !== "string") throw new Error("rebased request body is required");
    const rebasedRequestBody: unknown = JSON.parse(requestBody);
    expect(rebasedRequestBody).toMatchObject({
      baseReactionVersion: 2,
    });
  });

  it("treats a semantic 422 rejection as terminal without retry or read-back", async () => {
    const document = createReactionReadyGapNetworkView();
    const reaction = document.metadata.reactionPreparation?.overviewReaction;
    if (!reaction) throw new Error("prepared overview reaction is required");
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        Response.json(
          {
            error: "reaction does not match a prepared gap reaction",
            code: "GAP_REACTION_NOT_PREPARED",
            action: "correct-request",
            retryable: false,
          },
          { status: 422 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      persistGapReactionWithTransportRetry(
        { documentId: document.id, reaction },
        document.reactionVersion,
      ),
    ).rejects.toBeInstanceOf(DefiniteGapReactionWriteError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an unconfirmed response when the write is superseded before retry", async () => {
    const document = createReactionReadyGapNetworkView();
    const reaction = document.metadata.reactionPreparation?.overviewReaction;
    if (!reaction) throw new Error("prepared overview reaction is required");
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(JSON.stringify(document), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    let continuationChecks = 0;

    const error = await persistGapReactionWithTransportRetry(
      { documentId: document.id, reaction },
      document.reactionVersion,
      () => {
        continuationChecks += 1;
        return continuationChecks === 1;
      },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnconfirmedGapReactionWriteError);
    expect(error).toMatchObject({ latestDocument: document });
    expect(continuationChecks).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

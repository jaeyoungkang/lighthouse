"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { GapNetworkMetadata, ResearchRoutePayload } from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import {
  persistGapReactionWithTransportRetry,
  UnconfirmedGapReactionWriteError,
} from "@/app/components/research-route-renderers/gap-reaction-write-transport";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import {
  advanceUpdatedAtAfterCurrent,
  getPersistedLatestReaction,
} from "@/app/stores/research-route-store-internals";

interface PendingReactionWrite {
  documentId: string;
  executionId: string;
  reaction: RouteAiComment;
  baseReactionVersion: number;
  sequence: number;
}

interface GapReactionWriteCoordinator {
  key: string;
  activeWrite: Promise<void> | null;
  drain: () => void;
  pendingWrite: PendingReactionWrite | null;
  sequence: number;
  timestamp: number;
}

function createGapReactionWriteCoordinator(key: string): GapReactionWriteCoordinator {
  return {
    key,
    activeWrite: null,
    drain: () => undefined,
    pendingWrite: null,
    sequence: 0,
    timestamp: 0,
  };
}

function isWriteAttached(write: PendingReactionWrite): boolean {
  const state = useResearchRouteStore.getState();
  return (
    state.activeExecutionId === write.executionId && state.currentView?.id === write.documentId
  );
}

function mergeConfirmedReaction(
  current: ResearchRoutePayload,
  confirmed: ResearchRoutePayload,
): ResearchRoutePayload | null {
  if (current.id !== confirmed.id || confirmed.reactionVersion < current.reactionVersion) {
    return null;
  }
  return {
    ...current,
    version: Math.max(current.version, confirmed.version),
    reactionVersion: confirmed.reactionVersion,
    reaction: confirmed.reaction ?? null,
    reactionHistory: confirmed.reactionHistory ?? [],
    updatedAt: advanceUpdatedAtAfterCurrent(current.updatedAt, confirmed.updatedAt),
  };
}

function reconcileConfirmedReaction(
  coordinator: GapReactionWriteCoordinator,
  write: PendingReactionWrite,
  confirmed: ResearchRoutePayload,
): void {
  if (!isWriteAttached(write)) return;
  const state = useResearchRouteStore.getState();
  const current = state.currentView;
  if (!current) return;
  const merged = mergeConfirmedReaction(current, confirmed);
  const acceptedDocument =
    merged && state.patchCurrentView(merged, write.executionId)
      ? merged
      : (useResearchRouteStore.getState().currentView ?? current);
  const pending = coordinator.pendingWrite;
  if (pending && isWriteAttached(pending)) {
    pending.baseReactionVersion = Math.max(
      pending.baseReactionVersion,
      acceptedDocument.reactionVersion,
    );
    useResearchRouteStore
      .getState()
      .setRouteAiComment(pending.documentId, pending.reaction, pending.executionId);
    return;
  }
  if (coordinator.sequence === write.sequence) {
    useResearchRouteStore
      .getState()
      .setRouteAiComment(
        write.documentId,
        getPersistedLatestReaction(acceptedDocument),
        write.executionId,
      );
  }
}

function settleFailedReactionWrite(
  coordinator: GapReactionWriteCoordinator,
  write: PendingReactionWrite,
  error: unknown,
): void {
  if (!isWriteAttached(write)) return;
  if (error instanceof UnconfirmedGapReactionWriteError && error.latestDocument) {
    reconcileConfirmedReaction(coordinator, write, error.latestDocument);
    console.error("[gap-reaction-persistence] write outcome unconfirmed", {
      documentId: write.documentId,
      error,
    });
    return;
  }
  const pendingWrite = coordinator.pendingWrite;
  if (pendingWrite && pendingWrite.sequence > write.sequence) return;
  if (coordinator.pendingWrite == null && coordinator.sequence === write.sequence) {
    const current = useResearchRouteStore.getState().currentView;
    useResearchRouteStore
      .getState()
      .setRouteAiComment(
        write.documentId,
        current?.id === write.documentId ? getPersistedLatestReaction(current) : null,
        write.executionId,
      );
  }
  console.error("[gap-reaction-persistence] write failed", {
    documentId: write.documentId,
    error,
  });
}

async function persistQueuedReaction(
  coordinator: GapReactionWriteCoordinator,
  write: PendingReactionWrite,
): Promise<void> {
  if (!isWriteAttached(write)) return;
  const currentVersion = useResearchRouteStore.getState().currentView?.reactionVersion ?? 0;
  try {
    const confirmed = await persistGapReactionWithTransportRetry(
      write,
      Math.max(write.baseReactionVersion, currentVersion),
      () =>
        isWriteAttached(write) &&
        (coordinator.pendingWrite == null || coordinator.pendingWrite.sequence <= write.sequence),
    );
    reconcileConfirmedReaction(coordinator, write, confirmed);
  } catch (error) {
    settleFailedReactionWrite(coordinator, write, error);
  }
}

export function useGapPreparedReactionPersistence(params: {
  activeExecutionId: string | null;
  document: ResearchRoutePayload;
  reactionPreparation: GapNetworkMetadata["reactionPreparation"];
  setRouteAiComment: ReturnType<typeof useResearchRouteStore.getState>["setRouteAiComment"];
}) {
  const { activeExecutionId, document, reactionPreparation, setRouteAiComment } = params;
  const coordinatorKey = `${document.id}:${activeExecutionId ?? "inactive"}`;
  const coordinatorRef = useRef(createGapReactionWriteCoordinator(coordinatorKey));

  const drainReactionWrites = useCallback(() => {
    const coordinator = coordinatorRef.current;
    if (coordinator.activeWrite) return;
    const write = coordinator.pendingWrite;
    coordinator.pendingWrite = null;
    if (!write || !isWriteAttached(write)) return;
    const activeWrite = persistQueuedReaction(coordinator, write).finally(() => {
      if (coordinator.activeWrite === activeWrite) coordinator.activeWrite = null;
      coordinator.drain();
    });
    coordinator.activeWrite = activeWrite;
  }, []);

  useLayoutEffect(() => {
    const coordinator = coordinatorRef.current;
    if (coordinator.key !== coordinatorKey) {
      coordinator.key = coordinatorKey;
      coordinator.activeWrite = null;
      coordinator.pendingWrite = null;
      coordinator.sequence = 0;
      coordinator.timestamp = 0;
    }
    coordinator.drain = drainReactionWrites;
    drainReactionWrites();
  }, [coordinatorKey, drainReactionWrites]);

  return useCallback(
    (reactionId: "overview" | { clusterId: string } | { gapPairId: string }) => {
      const template =
        reactionId === "overview"
          ? (reactionPreparation?.overviewReaction ?? null)
          : "clusterId" in reactionId
            ? (reactionPreparation?.clusterReactions.find(
                (entry) => entry.clusterId === reactionId.clusterId,
              )?.reaction ?? null)
            : (reactionPreparation?.gapReactions.find(
                (entry) => entry.gapPairId === reactionId.gapPairId,
              )?.reaction ?? null);
      if (!template || !activeExecutionId) return;

      const coordinator = coordinatorRef.current;
      const selectedAt = Math.max(Date.now(), coordinator.timestamp + 1);
      coordinator.timestamp = selectedAt;
      const reaction: RouteAiComment = {
        ...template,
        timestamp: new Date(selectedAt).toISOString(),
      };
      coordinator.sequence += 1;
      setRouteAiComment(document.id, reaction, activeExecutionId);
      const currentView = useResearchRouteStore.getState().currentView;
      coordinator.pendingWrite = {
        documentId: document.id,
        executionId: activeExecutionId,
        reaction,
        baseReactionVersion:
          currentView?.id === document.id ? currentView.reactionVersion : document.reactionVersion,
        sequence: coordinator.sequence,
      };
      coordinator.drain();
    },
    [
      activeExecutionId,
      document.id,
      document.reactionVersion,
      reactionPreparation,
      setRouteAiComment,
    ],
  );
}

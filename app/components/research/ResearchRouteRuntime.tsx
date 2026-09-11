"use client";

// @promise promise:research-route-cap-feedback
// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:graph-neighbor-papers
// @promise promise:reaction-from-visible-snapshot
// @promise promise:search-query-route-transition
// @aspect aspect:search-first-url-model
// @aspect aspect:route-view-ai-reaction-rules
// @check acceptance-check:research-route-cap-feedback-canonical-url
// @check acceptance-check:route-view-ai-comment-inline-surface-empty-state-no-reserve
// @check acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
// @check acceptance-check:route-view-ai-comment-inline-surface-transport-timeout
// @check acceptance-check:graph-neighbor-papers-reaction-own-view
// @check acceptance-check:reaction-from-visible-snapshot-snapshot-input
// @check acceptance-check:reaction-from-visible-snapshot-basis-match
// @check acceptance-check:search-query-route-transition-url-owned

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { ResearchRouteLayout } from "@/app/components/research/ResearchRouteLayout";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import {
  getAiCommentGenerationForTargetPayload,
  useRouteAiCommentGenerationRuntime,
} from "@/app/components/research/route-ai-comment-generation-runtime";
import { isRouteAiCommentGenerationTrigger } from "@/app/components/research/route-ai-comment-generation-scheduler";
import { buildRouteAiCommentGenerationCommand } from "@/app/components/research/research-route-runtime.helpers";

let nextResearchRouteRuntimeMount = 1;

function createResearchRouteRuntimeMountId(): string {
  const mountId = nextResearchRouteRuntimeMount;
  nextResearchRouteRuntimeMount += 1;
  return `research-route-runtime-${String(mountId)}`;
}

export interface ResearchRouteRuntimeProps {
  runtimeId: string;
  initialView?: ResearchRoutePayload | null;
  /** Empty `/search` start route: render the route-owned initial search screen. */
  initialSearchEntry?: boolean;
  renderViewBody: (view: ResearchRoutePayload, reactionSlot: ReactNode) => ReactNode;
}

function useInitialDocumentHydration(params: {
  initialRouteView: ResearchRoutePayload | null;
  executionId: string;
  setCurrentView: (view: ResearchRoutePayload | null, executionId: string) => void;
  clearCurrentView: (expectedExecutionId: string) => void;
}) {
  const { clearCurrentView, executionId, initialRouteView, setCurrentView } = params;

  useLayoutEffect(() => {
    setCurrentView(initialRouteView, executionId);
  }, [executionId, initialRouteView, setCurrentView]);

  // 뷰의 수명은 route와 함께 끝난다. unmount에서 store를 비워, 이 route의
  // view가 다음 route의 store 읽기(view snapshot, background task, shell
  // fingerprint)로 살아남지 않게 한다.
  // @check acceptance-check:search-query-route-transition-route-owned-render
  useLayoutEffect(
    () => () => {
      clearCurrentView(executionId);
    },
    [clearCurrentView, executionId],
  );
}

// store는 전역이라 route 전환 첫 렌더에서 이전 route의 뷰를 아직 들고 있을 수
// 있다. 이 route가 주입하지 않은 view는 renderer와 reaction 앵커에 절대
// 도달하지 않는다: hydration 전에는 null을 반환하고, 화면은 route 주입 view로
// 그린다.
// @check acceptance-check:search-query-route-transition-route-owned-render
function useFocusedRouteView(params: {
  executionId: string;
  initialRouteViewId: string | null;
}): ResearchRoutePayload | null {
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const storeDocument = useResearchRouteStore((state) => state.currentView);
  if (activeExecutionId !== params.executionId) return null;
  if (storeDocument?.id === params.initialRouteViewId) {
    return storeDocument;
  }
  return null;
}

export function ResearchRouteRuntime({
  runtimeId: ownerPrincipalId,
  initialView = null,
  initialSearchEntry = false,
  renderViewBody,
}: ResearchRouteRuntimeProps) {
  const [runtimeMountId] = useState(createResearchRouteRuntimeMountId);
  const registerSendMessage = useReactionActionStore((s) => s.registerSendMessage);
  const unregisterSendMessage = useReactionActionStore((s) => s.unregisterSendMessage);
  const setCurrentView = useResearchRouteStore((s) => s.setCurrentView);
  const clearCurrentView = useResearchRouteStore((s) => s.clearCurrentView);
  const setRouteAiComment = useResearchRouteStore((s) => s.setRouteAiComment);
  const markRouteAiCommentGenerationPending = useResearchRouteStore(
    (s) => s.markRouteAiCommentGenerationPending,
  );
  const markRouteAiCommentGenerationStarted = useResearchRouteStore(
    (s) => s.markRouteAiCommentGenerationStarted,
  );
  const clearRouteAiCommentRegeneration = useResearchRouteStore(
    (s) => s.clearRouteAiCommentRegeneration,
  );
  const initialRouteViewId = initialView?.id ?? null;
  const initialRouteViewUpdatedAt = initialView?.updatedAt ?? null;
  const executionViewKey =
    initialRouteViewId && initialRouteViewUpdatedAt
      ? `${ownerPrincipalId}:${initialRouteViewId}:${initialRouteViewUpdatedAt}`
      : `${ownerPrincipalId}:${initialRouteViewId ?? "empty"}`;
  const executionId = `${runtimeMountId}:${executionViewKey}`;
  const focusedView = useFocusedRouteView({ executionId, initialRouteViewId });
  // 화면은 hydration 전에도 route 주입 문서를 그린다 — 이전 route의 store
  // 잔재가 아니라 이 route가 소유한 뷰만 보인다.
  const visibleRouteView = focusedView ?? initialView;
  const { enqueueAndScheduleRouteAiCommentGeneration } = useRouteAiCommentGenerationRuntime({
    executionId,
    document: focusedView,
    bootstrapViewId: initialRouteViewId,
    setRouteAiComment,
    markRouteAiCommentGenerationPending,
    markRouteAiCommentGenerationStarted,
    clearRouteAiCommentRegeneration,
  });

  useEffect(() => {
    registerSendMessage(({ text, eventType, targetRoutePayloadId }) => {
      void text;
      if (!eventType || !targetRoutePayloadId || !isRouteAiCommentGenerationTrigger(eventType)) {
        return;
      }
      const currentView = useResearchRouteStore.getState().currentView;
      if (currentView?.id !== targetRoutePayloadId) return;
      const command = buildRouteAiCommentGenerationCommand(currentView);
      if (!command || command.trigger !== eventType) return;
      const reactionGeneration = getAiCommentGenerationForTargetPayload(
        targetRoutePayloadId,
        executionId,
      );
      if (reactionGeneration === undefined) return;
      enqueueAndScheduleRouteAiCommentGeneration({
        executionId,
        trigger: command.trigger,
        createdAt: Date.now(),
        ownerPrincipalId: command.ownerPrincipalId,
        targetRoutePayloadId,
        viewSnapshot: command.viewSnapshot,
        reactionGeneration,
      });
    });

    return () => {
      unregisterSendMessage();
    };
  }, [
    enqueueAndScheduleRouteAiCommentGeneration,
    registerSendMessage,
    unregisterSendMessage,
    ownerPrincipalId,
    executionId,
  ]);

  useInitialDocumentHydration({
    executionId,
    initialRouteView: initialView,
    setCurrentView,
    clearCurrentView,
  });

  return (
    <div className="flex min-h-full flex-col">
      <div data-reaction-content className="relative flex-1">
        <ResearchRouteLayout
          currentView={visibleRouteView}
          initialSearchEntry={initialSearchEntry}
          renderViewBody={renderViewBody}
        />
      </div>
    </div>
  );
}

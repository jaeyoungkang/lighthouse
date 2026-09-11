"use client";

import type { FollowupActivationEvent } from "./search-view.helpers";

// @promise promise:research-route-cap-feedback
// @aspect aspect:search-first-url-model
// @check acceptance-check:research-route-cap-feedback-canonical-url

export function shouldOpenFollowupInNewWindow(event?: FollowupActivationEvent): boolean {
  return (
    event?.ctrlKey === true ||
    event?.metaKey === true ||
    event?.shiftKey === true ||
    event?.button === 1
  );
}

export function navigateFollowupRoute(
  route: string,
  navigate: (route: string) => void,
  event?: FollowupActivationEvent,
): boolean {
  if (shouldOpenFollowupInNewWindow(event) && typeof window !== "undefined") {
    return window.open(route, "_blank", "noopener,noreferrer") !== null;
  }
  navigate(route);
  return true;
}

// 연구 공백 진입은 검색·인용 관계·비슷한 논문 어느 surface에서든 modifier 키와
// 무관하게 항상 새 브라우저 창(detached)으로 gap-network ResearchRoutePayload를 연다
// (aspect:knowledge-map-followup-surface). 각 document host가 같은 강제 새-창
// activation으로 navigateFollowupRoute를 호출해 한 surface만 같은 탭으로 갈리지 않게 한다.
export const FORCE_NEW_WINDOW_ACTIVATION: FollowupActivationEvent = { ctrlKey: true };

import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { GapResearchRouteRuntime } from "@/app/(research)/research-route-runtimes";

// GapResearchRouteRuntime은 ResearchRouteRuntime에 renderViewBody만 넘긴다. 이
// 테스트는 그 renderViewBody가 실제 렌더러(GapNetworkView)를 dynamic import 없이
// 관찰하기 위해 ResearchRouteRuntime을 stub으로 대체하고, 넘어온 renderViewBody를
// 직접 호출해 element key만 검증한다.
vi.mock("@/app/components/research/ResearchRouteRuntime", () => ({
  ResearchRouteRuntime: () => null,
}));

type RenderViewBody = (view: ResearchRoutePayload) => React.ReactNode;

function readRuntimeProps(gapAdmissionBlocked = false) {
  return GapResearchRouteRuntime({ runtimeId: "user-1", gapAdmissionBlocked }) as {
    props: { renderViewBody: RenderViewBody };
  };
}

function readRenderViewBody(): RenderViewBody {
  return readRuntimeProps().props.renderViewBody;
}

function makeView(id: string): ResearchRoutePayload {
  return { id } as ResearchRoutePayload;
}

describe("GapResearchRouteRuntime view body keying", () => {
  it("keys the gap view body by report id so a different report remounts", () => {
    // 다른 report(view.id)로 바뀌면 GapNetworkView가 remount되어 마운트 시
    // 한 번만 잡히는 애니메이션 클럭(startedPending/elapsedMs)이 초기화된다.
    const renderViewBody = readRenderViewBody();

    const first = renderViewBody(makeView("gap-a"));
    const second = renderViewBody(makeView("gap-b"));

    if (!isValidElement(first) || !isValidElement(second)) {
      throw new Error("expected renderViewBody to return elements");
    }

    expect(first.key).toBe("gap-a");
    expect(second.key).toBe("gap-b");
    expect(first.key).not.toBe(second.key);
  });

  it("keeps the same key across in-place build-lifecycle updates of one report", () => {
    // patchCurrentView는 같은 report의 payload만 갱신하므로 view.id는 그대로다.
    // 같은 key → remount 없음 → 진행 중 애니메이션 클럭이 보존된다.
    const renderViewBody = readRenderViewBody();

    const pending = renderViewBody(makeView("gap-a"));
    const settled = renderViewBody(makeView("gap-a"));

    if (!isValidElement(pending) || !isValidElement(settled)) {
      throw new Error("expected renderViewBody to return elements");
    }

    expect(pending.key).toBe(settled.key);
  });

  it("passes the admission-blocked route signal to the gap renderer", () => {
    const rendered = readRuntimeProps(true).props.renderViewBody(makeView("gap-active"));
    if (!isValidElement<{ gapAdmissionBlocked?: boolean }>(rendered)) {
      throw new Error("expected renderViewBody to return an element");
    }

    expect(rendered.props.gapAdmissionBlocked).toBe(true);
  });
});

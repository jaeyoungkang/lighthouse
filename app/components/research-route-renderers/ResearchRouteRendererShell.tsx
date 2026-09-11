"use client";

// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:document-content-width-governance
// @check acceptance-check:route-view-ai-comment-inline-surface-consistent-document-layout

export function ResearchRouteRendererShell({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface-research flex w-full flex-col">{children}</div>;
}

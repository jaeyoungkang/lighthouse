import { t } from "@/app/i18n/message-access";

export interface GraphProgressStage {
  id:
    | "collect"
    | "enrich"
    | "cluster"
    | "analyze"
    | "extract"
    | "map"
    | "judge"
    | "compute"
    | "aggregate"
    | "frontier"
    | "matrix"
    | "path"
    | "gap"
    | "interpret"
    | "completed";
  label: string;
  detail: string;
  progress: number;
}

export const GRAPH_PROGRESS_STAGES: GraphProgressStage[] = [
  {
    id: "collect",
    label: t("knowledgeMap.progress.graph-progress.collect"),
    detail: t("knowledgeMap.label.graph-progress.collect"),
    progress: 1 / 6,
  },
  {
    id: "enrich",
    label: t("knowledgeMap.progress.graph-progress.enrich"),
    detail: t("knowledgeMap.label.graph-progress.enrich"),
    progress: 2 / 6,
  },
  {
    id: "cluster",
    label: t("knowledgeMap.progress.graph-progress.cluster"),
    detail: t("knowledgeMap.label.graph-progress.cluster"),
    progress: 3 / 6,
  },
  {
    id: "analyze",
    label: t("knowledgeMap.progress.graph-progress.analyze"),
    detail: t("knowledgeMap.label.graph-progress.analyze"),
    progress: 4 / 6,
  },
  {
    id: "interpret",
    label: t("knowledgeMap.progress.graph-progress.interpret"),
    detail: t("knowledgeMap.label.graph-progress.interpret"),
    progress: 5 / 6,
  },
  {
    id: "completed",
    label: t("knowledgeMap.progress.graph-progress.completed"),
    detail: t("knowledgeMap.label.graph-progress.completed"),
    progress: 1,
  },
];

const PENDING_STAGE_WINDOW_MS = 8000;

export function buildGraphPendingProgressView(params: {
  elapsedMs: number;
  isCompleted?: boolean;
}): GraphProgressStage {
  if (params.isCompleted) {
    const completedStage = GRAPH_PROGRESS_STAGES.at(-1);
    if (!completedStage) {
      throw new Error("graph progress stages must include completed state");
    }
    return completedStage;
  }

  const pendingStages = GRAPH_PROGRESS_STAGES.slice(0, -1);
  const stageIndex = Math.min(
    Math.max(Math.floor(params.elapsedMs / PENDING_STAGE_WINDOW_MS), 0),
    pendingStages.length - 1,
  );
  const stage = pendingStages.at(stageIndex);
  if (!stage) {
    throw new Error("graph progress stages must include pending state");
  }
  return stage;
}

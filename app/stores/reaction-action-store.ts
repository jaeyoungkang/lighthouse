// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:reaction-from-visible-snapshot
// @aspect aspect:route-view-ai-reaction-rules
// @check acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
// @check acceptance-check:reaction-from-visible-snapshot-basis-match

import { create } from "zustand";

type SendMessageFn = (options: {
  text: string;
  eventType?: string;
  targetRoutePayloadId?: string;
}) => void;

interface ReactionActionState {
  sendMessageImpl: SendMessageFn | null;
  registerSendMessage: (fn: SendMessageFn) => void;
  unregisterSendMessage: () => void;
  emitSystemEvent: (eventType: string, description: string, targetRoutePayloadId?: string) => void;
}

export const useReactionActionStore = create<ReactionActionState>((set, get) => ({
  sendMessageImpl: null,

  registerSendMessage: (fn) => {
    set({ sendMessageImpl: fn });
  },
  unregisterSendMessage: () => {
    set({ sendMessageImpl: null });
  },
  emitSystemEvent: (eventType, description, targetRoutePayloadId) => {
    const { sendMessageImpl } = get();
    if (!sendMessageImpl) return;

    sendMessageImpl({ text: description, eventType, targetRoutePayloadId });
  },
}));

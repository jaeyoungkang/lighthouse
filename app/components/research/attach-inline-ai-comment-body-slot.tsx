// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:progressive-content-spatial-stability

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

function attachSlotToChildren(
  children: ReactNode,
  inlineBodyAppendSlot: ReactNode,
): { children: ReactNode; attached: boolean } {
  let attached = false;
  const mappedChildren = Children.map(children, (child) => {
    if (!isValidElement(child) || typeof child.type === "string") {
      return child;
    }
    if (child.type === Fragment) {
      const fragment = child as ReactElement<{ children?: ReactNode }>;
      const nested = attachSlotToChildren(fragment.props.children, inlineBodyAppendSlot);
      attached ||= nested.attached;
      return cloneElement(fragment, undefined, nested.children);
    }
    attached = true;
    return cloneElement(child as ReactElement<{ inlineBodyAppendSlot?: ReactNode }>, {
      inlineBodyAppendSlot,
    });
  });

  return { children: mappedChildren, attached };
}

/**
 * Route renderers hand the optional research-term line to the inline AgentPanel
 * so the comment body, term links, and controls share one stable generated region.
 */
export function attachInlineAiCommentBodySlot(
  reactionSlot: ReactNode,
  inlineBodyAppendSlot: ReactNode,
): ReactNode {
  if (!reactionSlot || !inlineBodyAppendSlot || !isValidElement(reactionSlot)) {
    return reactionSlot;
  }

  const wrapper = reactionSlot as ReactElement<{ children?: ReactNode }>;
  const result = attachSlotToChildren(wrapper.props.children, inlineBodyAppendSlot);

  return cloneElement(
    wrapper,
    undefined,
    result.attached ? (
      result.children
    ) : (
      <>
        {result.children}
        {inlineBodyAppendSlot}
      </>
    ),
  );
}

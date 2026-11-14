import { create } from "zustand";
import { useChatRuns } from "./chat-runs-store.ts";
import {
  collectGuidanceTargets,
  guidanceViewKey,
  isGuidanceTargetAvailable,
  type GuidanceTarget,
} from "./guidance-targets.ts";

interface GuidanceSnapshot {
  id: string;
  view: string;
  thread: string | null;
  createdAt: number;
  elements: Map<string, HTMLElement>;
}
interface TeachingBubble {
  element: HTMLElement;
  title: string;
  message: string;
  view: string;
  thread: string | null;
}

let snapshot: GuidanceSnapshot | null = null;
let hostCount = 0;
export const useTeachingBubble = create<{ bubble: TeachingBubble | null }>(() => ({
  bubble: null,
}));

export function dismissTeachingBubble() {
  snapshot = null;
  useTeachingBubble.setState({ bubble: null });
}

export function mountTeachingBubbleHost() {
  hostCount++;
  return () => {
    hostCount--;
    if (!hostCount) dismissTeachingBubble();
  };
}

export function getGuidanceTargets() {
  if (!hostCount) return { status: "unavailable", message: "This shell has no guidance host." };
  const id = crypto.randomUUID();
  const items = collectGuidanceTargets();
  const elements = new Map<string, HTMLElement>();
  const targets: GuidanceTarget[] = items.map(({ target, element }, index) => {
    const targetId = `${id}:${index}`;
    elements.set(targetId, element);
    return { ...target, targetId };
  });
  snapshot = {
    id,
    elements,
    view: guidanceViewKey(),
    thread: useChatRuns.getState().foregroundId,
    createdAt: Date.now(),
  };
  return { status: "success", snapshotId: id, targets };
}

export function showTeachingBubble(args: Record<string, unknown>) {
  if (
    !snapshot ||
    args.snapshotId !== snapshot.id ||
    snapshot.view !== guidanceViewKey() ||
    snapshot.thread !== useChatRuns.getState().foregroundId ||
    Date.now() - snapshot.createdAt > 120_000
  ) {
    return { status: "stale_context", message: "Read ui_get_guidance_targets again." };
  }
  const element = snapshot.elements.get(String(args.targetId));
  if (!element || !isGuidanceTargetAvailable(element)) return { status: "target_not_found" };
  if (
    typeof args.title !== "string" ||
    !args.title.trim() ||
    args.title.length > 100 ||
    typeof args.message !== "string" ||
    !args.message.trim() ||
    args.message.length > 600
  )
    return { status: "invalid_arguments", message: "Use a short title and explanation." };
  element.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  useTeachingBubble.setState({
    bubble: {
      element,
      title: args.title,
      message: args.message,
      view: snapshot.view,
      thread: snapshot.thread,
    },
  });
  return { status: "shown", message: "Hint displayed. The user has not completed the action yet." };
}

export function teachingBubbleIsCurrent(bubble: TeachingBubble) {
  return (
    bubble.view === guidanceViewKey() &&
    bubble.thread === useChatRuns.getState().foregroundId &&
    isGuidanceTargetAvailable(bubble.element)
  );
}

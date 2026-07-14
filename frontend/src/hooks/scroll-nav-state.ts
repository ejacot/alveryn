export type ScrollNavState = "expanded" | "compact";

type NextScrollNavStateOptions = {
  currentState: ScrollNavState;
  previousScrollTop: number;
  rawScrollTop: number;
  viewportHeight: number;
  documentHeight: number;
  deltaThreshold?: number;
  edgeThreshold?: number;
};

export function clampScrollTop(rawScrollTop: number, viewportHeight: number, documentHeight: number) {
  const maxScrollTop = Math.max(0, documentHeight - viewportHeight);
  if (!Number.isFinite(rawScrollTop)) {
    return 0;
  }
  return Math.min(Math.max(0, rawScrollTop), maxScrollTop);
}

export function getNextScrollNavState({
  currentState,
  previousScrollTop,
  rawScrollTop,
  viewportHeight,
  documentHeight,
  deltaThreshold = 18,
  edgeThreshold = 24
}: NextScrollNavStateOptions): { state: ScrollNavState; scrollTop: number } {
  const scrollTop = clampScrollTop(rawScrollTop, viewportHeight, documentHeight);
  const maxScrollTop = Math.max(0, documentHeight - viewportHeight);

  if (scrollTop <= edgeThreshold) {
    return { state: "expanded", scrollTop };
  }

  if (scrollTop >= maxScrollTop - edgeThreshold) {
    return { state: currentState, scrollTop };
  }

  const delta = scrollTop - previousScrollTop;
  if (Math.abs(delta) < deltaThreshold) {
    return { state: currentState, scrollTop };
  }

  return { state: delta > 0 ? "compact" : "expanded", scrollTop };
}

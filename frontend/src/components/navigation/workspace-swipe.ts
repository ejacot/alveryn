export type WorkspaceRoute = "/" | "/calendar" | "/statistics";

export const WORKSPACE_ROUTES: WorkspaceRoute[] = ["/", "/calendar", "/statistics"];

export type GestureAxis = "undecided" | "horizontal" | "vertical";

export type SwipeDecisionInput = {
  offsetX: number;
  offsetY: number;
  velocityX: number;
  viewportWidth: number;
  currentIndex: number;
  routeCount?: number;
};

export type SwipeDecision = {
  axis: GestureAxis;
  targetIndex: number;
  shouldNavigate: boolean;
};

const AXIS_LOCK_DISTANCE = 10;
const AXIS_DOMINANCE_RATIO = 1.25;
const DISTANCE_THRESHOLD_RATIO = 0.42;
const FLICK_DISTANCE_RATIO = 0.16;
const FLICK_VELOCITY = 900;

export function getWorkspaceRouteIndex(pathname: string) {
  return WORKSPACE_ROUTES.indexOf(pathname as WorkspaceRoute);
}

export function isWorkspaceRoute(pathname: string) {
  return getWorkspaceRouteIndex(pathname) !== -1;
}

export function resolveGestureAxis(offsetX: number, offsetY: number): GestureAxis {
  const absX = Math.abs(offsetX);
  const absY = Math.abs(offsetY);

  if (absX < AXIS_LOCK_DISTANCE && absY < AXIS_LOCK_DISTANCE) {
    return "undecided";
  }

  if (absX > absY * AXIS_DOMINANCE_RATIO) {
    return "horizontal";
  }

  if (absY > absX) {
    return "vertical";
  }

  return "undecided";
}

export function clampWorkspaceOffset(offsetX: number, currentIndex: number, routeCount = WORKSPACE_ROUTES.length) {
  if (currentIndex <= 0 && offsetX > 0) {
    return 0;
  }

  if (currentIndex >= routeCount - 1 && offsetX < 0) {
    return 0;
  }

  return offsetX;
}

export function resolveWorkspaceSwipe({
  offsetX,
  offsetY,
  velocityX,
  viewportWidth,
  currentIndex,
  routeCount = WORKSPACE_ROUTES.length
}: SwipeDecisionInput): SwipeDecision {
  const axis = resolveGestureAxis(offsetX, offsetY);
  const clampedOffset = clampWorkspaceOffset(offsetX, currentIndex, routeCount);
  const direction = clampedOffset < 0 ? 1 : clampedOffset > 0 ? -1 : 0;
  const targetIndex = currentIndex + direction;

  if (axis !== "horizontal" || direction === 0 || targetIndex < 0 || targetIndex >= routeCount) {
    return { axis, targetIndex: currentIndex, shouldNavigate: false };
  }

  const distance = Math.abs(clampedOffset);
  const distanceThreshold = viewportWidth * DISTANCE_THRESHOLD_RATIO;
  const flickDistance = viewportWidth * FLICK_DISTANCE_RATIO;
  const hasDistance = distance >= distanceThreshold;
  const hasVelocity =
    distance >= flickDistance &&
    Math.abs(velocityX) >= FLICK_VELOCITY &&
    Math.sign(velocityX) === Math.sign(clampedOffset);

  return {
    axis,
    targetIndex: hasDistance || hasVelocity ? targetIndex : currentIndex,
    shouldNavigate: hasDistance || hasVelocity
  };
}

export function shouldIgnoreWorkspaceSwipe(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return true;
  }

  return Boolean(
    target.closest(
      [
        "[data-no-workspace-swipe]",
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "[role='button']",
        "[role='slider']",
        "[role='dialog']"
      ].join(",")
    )
  );
}

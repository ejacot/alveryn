import { Suspense, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppLogo } from "../branding/app-logo";
import { RouteFallback } from "../ui/route-fallback";
import { WeekSelector } from "./week-selector";
import {
  WORKSPACE_ROUTES,
  clampWorkspaceOffset,
  getWorkspaceRouteIndex,
  resolveGestureAxis,
  resolveWorkspaceSwipe,
  shouldIgnoreWorkspaceSwipe
} from "./workspace-swipe";
import { DashboardPage } from "../../pages/dashboard-page";
import { CalendarPage } from "../../pages/calendar-page";
import { StatisticsPage } from "../../pages/statistics-page";

type Props = {
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  visible: boolean;
};

const EDGE_EXCLUSION_PX = 28;
const SNAP_DURATION_MS = 260;

type GestureState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  axis: "undecided" | "horizontal" | "vertical";
  width: number;
};

export function MainWorkspace({ selectedDate, onSelectedDateChange, visible }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeIndex = getWorkspaceRouteIndex(location.pathname);
  const activeIndex = routeIndex === -1 ? 0 : routeIndex;
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const scrollersRef = useRef<Array<HTMLElement | null>>([]);
  const gestureRef = useRef<GestureState | null>(null);
  const scrollPositionsRef = useRef([0, 0, 0]);

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    setDragOffset(0);
    setIsDragging(false);
    setIsSettling(false);
  }, [location.pathname]);

  useEffect(() => {
    const scroller = scrollersRef.current[activeIndex];
    if (!scroller) {
      return;
    }
    scroller.scrollTop = scrollPositionsRef.current[activeIndex] ?? 0;
  }, [activeIndex]);

  function setScroller(index: number, node: HTMLElement | null) {
    scrollersRef.current[index] = node;
  }

  function handleScroll(index: number) {
    const scroller = scrollersRef.current[index];
    if (scroller) {
      scrollPositionsRef.current[index] = scroller.scrollTop;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!visible || event.pointerType === "mouse" || shouldIgnoreWorkspaceSwipe(event.target)) {
      return;
    }

    if (event.clientX <= EDGE_EXCLUSION_PX) {
      return;
    }

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocityX: 0,
      axis: "undecided",
      width: event.currentTarget.clientWidth || window.innerWidth
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const offsetX = event.clientX - gesture.startX;
    const offsetY = event.clientY - gesture.startY;
    const axis = gesture.axis === "undecided" ? resolveGestureAxis(offsetX, offsetY) : gesture.axis;

    if (axis === "vertical") {
      gestureRef.current = null;
      setDragOffset(0);
      setIsDragging(false);
      return;
    }

    gesture.axis = axis;

    if (axis !== "horizontal") {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();

    const now = performance.now();
    const elapsed = Math.max(now - gesture.lastTime, 1);
    gesture.velocityX = ((event.clientX - gesture.lastX) / elapsed) * 1000;
    gesture.lastX = event.clientX;
    gesture.lastTime = now;

    setIsDragging(true);
    setDragOffset(clampWorkspaceOffset(offsetX, activeIndex));
  }

  function finishGesture(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const offsetX = event.clientX - gesture.startX;
    const offsetY = event.clientY - gesture.startY;
    const decision = resolveWorkspaceSwipe({
      offsetX,
      offsetY,
      velocityX: gesture.velocityX,
      viewportWidth: gesture.width,
      currentIndex: activeIndex
    });

    gestureRef.current = null;
    setIsDragging(false);
    setIsSettling(true);

    if (decision.shouldNavigate) {
      navigate(WORKSPACE_ROUTES[decision.targetIndex]);
      window.setTimeout(() => setIsSettling(false), prefersReducedMotion ? 1 : SNAP_DURATION_MS);
      return;
    }

    setDragOffset(0);
    window.setTimeout(() => setIsSettling(false), prefersReducedMotion ? 1 : SNAP_DURATION_MS);
  }

  const transition =
    isDragging || prefersReducedMotion
      ? "none"
      : `transform ${SNAP_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;

  return (
    <div
      className={visible ? "workspace-root" : "workspace-root hidden"}
      data-testid="main-workspace"
      aria-hidden={!visible}
      inert={!visible}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
    >
      <div className="workspace-track">
        {WORKSPACE_ROUTES.map((route, index) => {
          const offset = (index - activeIndex) * 100;
          const transform = `translate3d(calc(${offset}vw + ${dragOffset}px), 0, 0)`;
          const isActive = index === activeIndex;
          return (
            <section
              key={route}
              ref={(node) => setScroller(index, node)}
              className="workspace-panel screen-shell overflow-y-auto overscroll-y-contain"
              style={{ transform, transition }}
              aria-hidden={!isActive}
              inert={!isActive}
              data-active={isActive ? "true" : "false"}
              onScroll={() => handleScroll(index)}
            >
              <Suspense fallback={<RouteFallback />}>
                {route === "/" ? (
                  <div className="space-y-4">
                    <header className="space-y-2.5 pt-1" data-scroll-region="page-top">
                      <div className="space-y-2.5">
                        <AppLogo />
                        <WeekSelector value={selectedDate} onChange={onSelectedDateChange} />
                      </div>
                    </header>
                    <DashboardPage selectedDate={selectedDate} />
                  </div>
                ) : route === "/calendar" ? (
                  <CalendarPage />
                ) : (
                  <StatisticsPage />
                )}
              </Suspense>
            </section>
          );
        })}
      </div>
      {isSettling ? <span className="sr-only">Switching section</span> : null}
    </div>
  );
}

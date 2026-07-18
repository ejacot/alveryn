import { useEffect, useRef, useState } from "react";
import { getNextScrollNavState, type ScrollNavState } from "./scroll-nav-state";

export function useScrollDirection(threshold = 8) {
  const [direction, setDirection] = useState<"up" | "down">("up");
  const stateRef = useRef<ScrollNavState>("expanded");
  const lastValue = useRef(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("compactNav") === "true") {
      setDirection("down");
      stateRef.current = "compact";
    }

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    lastValue.current = getNextScrollNavState({
      currentState: stateRef.current,
      previousScrollTop: 0,
      rawScrollTop: window.scrollY,
      viewportHeight,
      documentHeight: document.documentElement.scrollHeight,
      deltaThreshold: threshold
    }).scrollTop;

    function handleScroll() {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        if (document.documentElement.dataset.preserveScrollPosition === "true") {
          lastValue.current = window.scrollY;
          return;
        }
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const next = getNextScrollNavState({
          currentState: stateRef.current,
          previousScrollTop: lastValue.current,
          rawScrollTop: window.scrollY,
          viewportHeight,
          documentHeight: document.documentElement.scrollHeight,
          deltaThreshold: threshold
        });

        lastValue.current = next.scrollTop;
        if (next.state === stateRef.current) {
          return;
        }

        stateRef.current = next.state;
        setDirection(next.state === "compact" ? "down" : "up");
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [threshold]);

  return direction;
}

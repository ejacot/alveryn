import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export function RouteScrollReset() {
  const location = useLocation();
  const restoreScrollY = (location.state as { restoreScrollY?: unknown } | null)?.restoreScrollY;

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const shouldRestore = typeof restoreScrollY === "number" && Number.isFinite(restoreScrollY) && restoreScrollY >= 0;

    const reset = () => {
      if (shouldRestore) {
        window.scrollTo({ top: restoreScrollY, left: 0, behavior: "auto" });
        return;
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (!navigator.userAgent.toLowerCase().includes("jsdom")) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };

    reset();
    const frame = window.requestAnimationFrame(reset);

    return () => {
      window.cancelAnimationFrame(frame);
      window.history.scrollRestoration = previousRestoration;
    };
  }, [location.key, restoreScrollY]);

  return null;
}

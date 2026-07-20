import { useEffect, useState, type CSSProperties } from "react";

type ViewportRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const fullViewport: ViewportRect = {
  top: 0,
  left: 0,
  width: 0,
  height: 0
};

/**
 * Locks the document behind a modal and follows the visual viewport on mobile.
 * This keeps a centered dialog above the software keyboard without moving the page.
 */
export function useLockedVisualViewport(open: boolean): CSSProperties {
  const [viewport, setViewport] = useState<ViewportRect>(fullViewport);

  useEffect(() => {
    if (!open) return;

    const visualViewport = window.visualViewport;
    const syncViewport = () => {
      setViewport({
        top: visualViewport?.offsetTop ?? 0,
        left: visualViewport?.offsetLeft ?? 0,
        width: visualViewport?.width ?? window.innerWidth,
        height: visualViewport?.height ?? window.innerHeight
      });
    };

    const scrollTop = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const previousBody = {
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width
    };
    const previousRoot = {
      overflow: root.style.overflow,
      overscrollBehavior: root.style.overscrollBehavior
    };

    syncViewport();
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `${-scrollTop}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";

    visualViewport?.addEventListener("resize", syncViewport);
    visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);

    return () => {
      visualViewport?.removeEventListener("resize", syncViewport);
      visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      Object.assign(body.style, previousBody);
      Object.assign(root.style, previousRoot);
      if (window.scrollY !== scrollTop) {
        window.scrollTo({ top: scrollTop, left: 0, behavior: "auto" });
      }
    };
  }, [open]);

  if (!open || viewport.width === 0 || viewport.height === 0) {
    return { top: 0, left: 0, width: "100vw", height: "100dvh" };
  }

  return {
    top: viewport.top,
    left: viewport.left,
    width: viewport.width,
    height: viewport.height
  };
}

import { useEffect, useRef, useState } from "react";

export function useScrollDirection(threshold = 8) {
  const [direction, setDirection] = useState<"up" | "down">("up");
  const lastValue = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("compactNav") === "true") {
      setDirection("down");
    }

    lastValue.current = window.scrollY;

    function handleScroll() {
      const current = window.scrollY;
      const delta = current - lastValue.current;

      if (Math.abs(delta) < threshold) {
        return;
      }

      setDirection(delta > 0 ? "down" : "up");
      lastValue.current = current;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return direction;
}

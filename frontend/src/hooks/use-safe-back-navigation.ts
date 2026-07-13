import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

type Options = {
  fallback: string;
};

export function useSafeBackNavigation({ fallback }: Options) {
  const navigate = useNavigate();

  return useCallback(() => {
    const historyIndex =
      typeof window !== "undefined" && typeof window.history.state?.idx === "number"
        ? window.history.state.idx
        : 0;

    if (historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(fallback, { replace: true });
  }, [fallback, navigate]);
}

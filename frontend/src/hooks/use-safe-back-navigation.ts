import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

type Options = {
  fallback: string;
};

export function useSafeBackNavigation({ fallback }: Options) {
  const navigate = useNavigate();

  return useCallback(() => {
    navigate(fallback, { replace: true });
  }, [fallback, navigate]);
}

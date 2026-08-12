import { QueryClient } from "@tanstack/react-query";

const STATIC_QUERY_ROOTS = new Set([
  "preferences",
  "profile",
  "employments",
  "hourly-rates",
  "work-types",
  "absence-types",
  "schedules"
]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: (query) => STATIC_QUERY_ROOTS.has(String(query.queryKey[0])) ? 5 * 60_000 : 60_000,
      gcTime: 30 * 60_000
    },
    mutations: {
      retry: 0
    }
  }
});

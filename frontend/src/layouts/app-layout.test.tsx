import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppLayout } from "./app-layout";

vi.mock("../api/endpoints", () => ({
  getWorkEntries: vi.fn().mockResolvedValue({
    content: [],
    page: 0,
    size: 100,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
    hasNext: false,
    hasPrevious: false,
    numberOfElements: 0
  })
}));

vi.mock("../components/ui/page-transition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    Outlet: ({ context }: { context?: unknown }) => (
      <div data-testid="outlet" data-has-context={Boolean(context)} />
    )
  };
});

describe("AppLayout", () => {
  it("keeps the top section in normal page flow instead of a sticky header", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <QueryClientProvider client={queryClient}>
          <AppLayout />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const header = container.querySelector("header");

    expect(header).not.toBeNull();
    expect(header).toHaveAttribute("data-scroll-region", "page-top");
    expect(header?.className).not.toMatch(/\bsticky\b/);
    expect(header?.className).not.toMatch(/\bfixed\b/);
    expect(screen.getByText("Roomly")).toBeInTheDocument();
  });
});

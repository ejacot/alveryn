import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { APP_HOME_PATH } from "../routes/app-paths";
import { AppLayout } from "./app-layout";

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
  it("renders normal routed content without the persistent swipe workspace", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });

    render(
      <MemoryRouter initialEntries={[APP_HOME_PATH]}>
        <QueryClientProvider client={queryClient}>
          <AppLayout />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId("outlet")).toHaveAttribute("data-has-context", "true");
    expect(screen.queryByTestId("main-workspace")).not.toBeInTheDocument();
  });

  it("keeps full-screen background and primary navigation on settings subroutes", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/settings/work-types/new"]}>
        <QueryClientProvider client={queryClient}>
          <AppLayout />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(container.querySelector(".app-background")).not.toBeNull();
    expect(screen.getByLabelText("Primary navigation")).toBeInTheDocument();
    expect(screen.getByLabelText("Home")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
  });
});

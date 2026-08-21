import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { BottomNav } from "./bottom-nav";
import { listOrganizations } from "../../api/endpoints";
import { WorkspaceProvider } from "../../contexts/workspace-context";

vi.mock("../../api/endpoints", () => ({
  listOrganizations: vi.fn(),
}));

function renderNavigation() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WorkspaceProvider>
          <BottomNav />
        </WorkspaceProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BottomNav", () => {
  it("keeps business navigation hidden without a workspace", async () => {
    vi.mocked(listOrganizations).mockResolvedValue([]);
    const { container } = renderNavigation();

    expect(screen.getByLabelText("Today")).toBeInTheDocument();
    expect(screen.getByLabelText("Calendar")).toBeInTheDocument();
    expect(screen.getByLabelText("Insights")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.queryByLabelText("Schedule")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Business")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(4);

    const nav = container.querySelector("nav");
    expect(nav).toHaveClass("ios-glass-nav");
  });

  it("shows workspace-scoped navigation for an active Business", async () => {
    vi.mocked(listOrganizations).mockResolvedValue([
      {
        id: "org-1",
        name: "Hotel",
        type: "BUSINESS",
        timezone: "Europe/Berlin",
        role: "EMPLOYEE",
      },
    ]);
    renderNavigation();

    expect(await screen.findByLabelText("Schedule")).toBeInTheDocument();
    expect(await screen.findByLabelText("Business")).toBeInTheDocument();
    expect(screen.queryByLabelText("Today")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Calendar")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});

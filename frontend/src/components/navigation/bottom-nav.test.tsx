import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { BottomNav } from "./bottom-nav";
import { getOrganizationAccess, listOrganizations } from "../../api/endpoints";

vi.mock("../../api/endpoints", () => ({
  listOrganizations: vi.fn(),
  getOrganizationAccess: vi.fn(),
}));

function renderNavigation() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BottomNav />
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

  it("shows Schedule for membership and Business when permissions are granted", async () => {
    vi.mocked(listOrganizations).mockResolvedValue([
      {
        id: "org-1",
        name: "Hotel",
        type: "BUSINESS",
        timezone: "Europe/Berlin",
        role: "EMPLOYEE",
      },
    ]);
    vi.mocked(getOrganizationAccess).mockResolvedValue({
      permissions: ["VIEW_SCHEDULE"],
    });
    renderNavigation();

    expect(await screen.findByLabelText("Schedule")).toBeInTheDocument();
    expect(await screen.findByLabelText("Business")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(6);
  });
});

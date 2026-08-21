import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listOrganizations } from "../../api/endpoints";
import { WorkspaceProvider } from "../../contexts/workspace-context";
import { WorkspaceSwitcher } from "./workspace-switcher";

vi.mock("../../api/endpoints", () => ({
  listOrganizations: vi.fn(),
}));

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderSwitcher(initialEntry = "/app") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <WorkspaceProvider>
          <WorkspaceSwitcher />
          <LocationProbe />
        </WorkspaceProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(listOrganizations).mockResolvedValue([
      {
        id: "personal-1",
        name: "My workspace",
        type: "PERSONAL",
        timezone: "Europe/Berlin",
        role: "OWNER",
      },
      {
        id: "business-1",
        name: "Hotel Aurora",
        type: "BUSINESS",
        timezone: "Europe/Berlin",
        role: "OWNER",
      },
    ]);
  });

  it("defaults to Personal and persists a Business selection", async () => {
    renderSwitcher();

    const selector = await screen.findByLabelText("Active workspace");
    expect(selector).toHaveValue("personal-1");

    fireEvent.change(selector, { target: { value: "business-1" } });

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/business");
      expect(window.localStorage.getItem("alveryn.active-workspace")).toBe(
        "business-1",
      );
    });
  });

  it("uses the organization encoded in a Business planning route", async () => {
    window.localStorage.setItem("alveryn.active-workspace", "personal-1");
    renderSwitcher("/business/business-1/plan/schedule");

    expect(await screen.findByLabelText("Active workspace")).toHaveValue(
      "business-1",
    );
  });

  it("enters a Business context for a direct Business route", async () => {
    window.localStorage.setItem("alveryn.active-workspace", "personal-1");
    renderSwitcher("/business");

    expect(await screen.findByLabelText("Active workspace")).toHaveValue(
      "business-1",
    );
  });
});

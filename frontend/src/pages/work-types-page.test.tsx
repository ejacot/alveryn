import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { WorkTypesPage } from "./work-types-page";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock("../api/endpoints", () => ({
  createWorkType: vi.fn(),
  deleteWorkType: vi.fn(),
  listWorkTypes: vi.fn(),
  updateWorkType: vi.fn()
}));

import { createWorkType, deleteWorkType, listWorkTypes, updateWorkType } from "../api/endpoints";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <WorkTypesPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("WorkTypesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    vi.mocked(listWorkTypes).mockResolvedValue([
      {
        id: "work-type-time",
        name: "CHECK",
        calculationMethod: "TIME_BASED",
        color: "#FFFFFF",
        icon: null,
        defaultBreakMinutes: 30,
        displayOrder: 0,
        active: true
      },
      {
        id: "work-type-unit",
        name: "ROOMS",
        calculationMethod: "UNIT_BASED",
        color: "#FFFFFF",
        icon: null,
        defaultBreakMinutes: null,
        displayOrder: 1,
        active: true
      }
    ]);
    vi.mocked(updateWorkType).mockResolvedValue({
      id: "work-type-time",
      name: "SHIFT",
      calculationMethod: "TIME_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: 30,
      displayOrder: 0,
      active: true
    });
    vi.mocked(createWorkType).mockResolvedValue({
      id: "work-type-new",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 2,
      active: true
    });
    vi.mocked(deleteWorkType).mockResolvedValue(undefined);
  });

  it("creates a work type in the same centered dialog and opens unit setup for units", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Add work type" }));
    const dialog = screen.getByRole("dialog", { name: "Add work type" });
    await user.type(within(dialog).getByLabelText("Name"), "rooms");
    await user.click(within(dialog).getByRole("button", { name: "Units" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
	      expect(createWorkType).toHaveBeenCalledWith({
	        name: "ROOMS",
	        calculationMethod: "UNIT_BASED",
	        color: "#A3E635",
	        icon: null,
	        defaultBreakMinutes: null
	      });
      expect(navigateMock).toHaveBeenCalledWith("/settings/work-types/work-type-new");
    });
  });

  it("edits a time-based work type in a centered dialog", async () => {
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Time based")).toHaveClass("hairline-text");
    expect(screen.getByText("Unit based")).toHaveClass("hairline-text");
    await user.click(await screen.findByRole("button", { name: /check/i }));

    const dialog = screen.getByRole("dialog", { name: "CHECK" });
    await user.clear(within(dialog).getByLabelText("Name"));
    await user.type(within(dialog).getByLabelText("Name"), "shift");
    expect(within(dialog).getByDisplayValue("SHIFT")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Units" }));
    await user.click(within(dialog).getByRole("button", { name: "Choose color #34D399" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateWorkType).toHaveBeenCalledWith("work-type-time", {
        name: "SHIFT",
        calculationMethod: "UNIT_BASED",
        color: "#34D399",
        icon: null,
        defaultBreakMinutes: null,
        displayOrder: 0,
        active: true
      });
    });
  });

  it("deactivates a time-based work type from the dialog and keeps unit-based details as a page", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /check/i }));
    await user.click(within(screen.getByRole("dialog", { name: "CHECK" })).getByRole("button", { name: "Deactivate work type" }));

    await waitFor(() => {
      expect(deleteWorkType).toHaveBeenCalledWith("work-type-time");
    });

    await user.click(screen.getByRole("button", { name: /rooms/i }));
    expect(navigateMock).toHaveBeenCalledWith("/settings/work-types/work-type-unit");
  });
});

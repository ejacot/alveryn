import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
  listWorkTypes: vi.fn()
}));

import { listWorkTypes } from "../api/endpoints";

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
        compensationMethod: "HOURLY",
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
        compensationMethod: "HOURLY",
        color: "#FFFFFF",
        icon: null,
        defaultBreakMinutes: null,
        displayOrder: 1,
        active: true
      }
    ]);
  });

  it("renders work setup as the central configuration surface", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Work setup" })).toBeInTheDocument();
    expect(screen.queryByText(/Configure the activities/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Hours")).not.toBeInTheDocument();
    expect(screen.queryByText("Units to hours")).not.toBeInTheDocument();
    expect(screen.queryByText("Per unit")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /check/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rooms/i })).toBeInTheDocument();
  });

  it("opens the dedicated add work type flow", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Add work type" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Choose calculation");

    await user.click(screen.getByRole("button", { name: /time based/i }));

    expect(navigateMock).toHaveBeenCalledWith("/settings/work-types/new?mode=TIME_HOURLY", {
      state: {
        setupMode: "TIME_HOURLY",
        calculationMethod: "TIME_BASED",
        compensationMethod: "HOURLY"
      }
    });
  });

  it("opens an existing work type on its dedicated setup page", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /rooms/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/settings/work-types/work-type-unit");
    });
  });

  it("shows child work types only after expanding their parent card", async () => {
    vi.mocked(listWorkTypes).mockResolvedValue([
      {
        id: "parent-floor",
        name: "FLOOR HEATING",
        calculationMethod: "UNIT_BASED",
        compensationMethod: "PER_UNIT",
        color: "#FFFFFF",
        icon: null,
        defaultBreakMinutes: null,
        displayOrder: 0,
        active: true,
        compositeEnabled: true
      },
      {
        id: "child-normal",
        parentId: "parent-floor",
        name: "Normal m2",
        calculationMethod: "UNIT_BASED",
        compensationMethod: "PER_UNIT",
        unitLabel: "m2",
        unitSymbol: "m²",
        ratePerUnit: "50.0000",
        currency: "EUR",
        color: "#FFFFFF",
        icon: null,
        defaultBreakMinutes: null,
        displayOrder: 0,
        active: true
      }
    ]);
    renderPage();
    const user = userEvent.setup();

    const parentCard = await screen.findByRole("button", { name: /^FLOOR HEATING/i });
    expect(parentCard).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /normal m2/i })).not.toBeInTheDocument();

    await user.click(parentCard);

    expect(await screen.findByRole("button", { name: /normal m2/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /normal m2/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/settings/work-types/child-normal");
    });
  });
});

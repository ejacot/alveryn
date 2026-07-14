import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnitTypeEditorPage } from "./unit-type-editor-page";

const navigateMock = vi.fn();
const routeState: { workTypeId?: string; unitTypeId?: string } = {
  workTypeId: "work-type-1"
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => routeState
  };
});

vi.mock("../api/endpoints", () => ({
  createUnitType: vi.fn(),
  deleteUnitType: vi.fn(),
  getUnitType: vi.fn(),
  updateUnitType: vi.fn()
}));

vi.mock("../hooks/use-unsaved-changes-guard", () => ({
  useUnsavedChangesGuard: () => ({
    confirmOrRun: (action: () => void) => action(),
    dialog: null
  })
}));

import {
  createUnitType,
  deleteUnitType,
  getUnitType,
  updateUnitType
} from "../api/endpoints";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UnitTypeEditorPage />
    </QueryClientProvider>
  );
}

describe("UnitTypeEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.workTypeId = "work-type-1";
    routeState.unitTypeId = undefined;
    navigateMock.mockReset();
    vi.mocked(createUnitType).mockResolvedValue({
      id: "unit-type-1",
      workTypeId: "work-type-1",
      name: "Cameră normală",
      unitsPerHour: "2.4",
      displayOrder: 0,
      active: true
    });
    vi.mocked(updateUnitType).mockResolvedValue({
      id: "unit-type-1",
      workTypeId: "work-type-1",
      name: "Cameră normală",
      unitsPerHour: "2.4",
      displayOrder: 0,
      active: true
    });
    vi.mocked(getUnitType).mockResolvedValue({
      id: "unit-type-1",
      workTypeId: "work-type-1",
      name: "Cameră normală",
      unitsPerHour: "2.4",
      displayOrder: 0,
      active: true
    });
    vi.mocked(deleteUnitType).mockResolvedValue(undefined);
  });

  it("creates a unit type and accepts comma decimal input", async () => {
    renderPage();
    const user = userEvent.setup();
    const rateInput = screen.getByRole("textbox", { name: /units per hour/i });

    await user.clear(rateInput);
    await user.type(screen.getByLabelText("Name"), "Cameră normală");
    await user.type(rateInput, "2,4");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createUnitType).toHaveBeenCalledWith("work-type-1", {
        name: "Cameră normală",
        unitsPerHour: 2.4,
        active: true
      });
      expect(navigateMock).toHaveBeenCalledWith(
        "/settings/work-types/work-type-1",
        { replace: true }
      );
    });
  });

  it("shows visible validation instead of silently blocking submit", async () => {
    renderPage();
    const user = userEvent.setup();
    const rateInput = screen.getByRole("textbox", { name: /units per hour/i });

    await user.type(screen.getByLabelText("Name"), "Cameră normală");
    await user.clear(rateInput);
    await user.type(rateInput, "abc");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check the highlighted fields and try again."
    );
    expect(screen.getByText("Units per hour must be greater than zero")).toBeInTheDocument();
    expect(createUnitType).not.toHaveBeenCalled();
  });
});

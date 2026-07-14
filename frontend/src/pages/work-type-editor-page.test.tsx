import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkTypeEditorPage } from "./work-type-editor-page";

const navigateMock = vi.fn();
const routeState: { workTypeId?: string } = {};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => (routeState.workTypeId ? { workTypeId: routeState.workTypeId } : {})
  };
});

vi.mock("../api/endpoints", () => ({
  createWorkType: vi.fn(),
  deleteWorkType: vi.fn(),
  getWorkType: vi.fn(),
  listUnitTypes: vi.fn(),
  updateWorkType: vi.fn()
}));

vi.mock("../hooks/use-unsaved-changes-guard", () => ({
  useUnsavedChangesGuard: () => ({
    confirmOrRun: (action: () => void) => action(),
    dialog: null
  })
}));

import {
  createWorkType,
  deleteWorkType,
  getWorkType,
  listUnitTypes,
  updateWorkType
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
      <WorkTypeEditorPage />
    </QueryClientProvider>
  );
}

function validationError(message = "Validation failed", errors = ["name: Name already exists"]) {
  return {
    isAxiosError: true,
    response: {
      status: 400,
      data: {
        status: 400,
        code: "VALIDATION_ERROR",
        message,
        errors
      }
    }
  };
}

function workTypeNameExistsError() {
  return {
    isAxiosError: true,
    response: {
      status: 409,
      data: {
        status: 409,
        code: "WORK_TYPE_NAME_EXISTS",
        message: "Work type name already exists",
        errors: ["name: Work type name already exists"]
      }
    }
  };
}

describe("WorkTypeEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.workTypeId = undefined;
    navigateMock.mockReset();
    vi.mocked(createWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "Check",
      calculationMethod: "TIME_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: 30,
      displayOrder: 0,
      active: true
    });
    vi.mocked(updateWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "Check",
      calculationMethod: "TIME_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: 30,
      displayOrder: 0,
      active: true
    });
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "Check",
      calculationMethod: "TIME_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: 30,
      displayOrder: 0,
      active: true
    });
    vi.mocked(listUnitTypes).mockResolvedValue([]);
    vi.mocked(deleteWorkType).mockResolvedValue(undefined);
  });

  it("creates a time-based work type and returns to the list", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Check");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalled();
      expect(vi.mocked(createWorkType).mock.calls[0][0]).toEqual({
        name: "Check",
        calculationMethod: "TIME_BASED"
      });
      expect(navigateMock).toHaveBeenCalledWith("/settings/work-types", { replace: true });
    });
  });

  it("opens unit setup after creating a unit-based work type", async () => {
    vi.mocked(createWorkType).mockResolvedValue({
      id: "work-type-unit",
      name: "Camere",
      calculationMethod: "UNIT_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Camere");
    await user.selectOptions(screen.getByLabelText("Calculation method"), "UNIT_BASED");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(vi.mocked(createWorkType).mock.calls[0][0]).toEqual({
        name: "Camere",
        calculationMethod: "UNIT_BASED"
      });
      expect(navigateMock).toHaveBeenCalledWith("/settings/work-types/work-type-unit", { replace: true });
    });
  });

  it("creates a unit-based work type when hidden active value is absent", async () => {
    vi.mocked(createWorkType).mockResolvedValue({
      id: "work-type-unit",
      name: "Rooms",
      calculationMethod: "UNIT_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Rooms");
    await user.selectOptions(screen.getByLabelText("Calculation method"), "UNIT_BASED");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalledWith({
        name: "Rooms",
        calculationMethod: "UNIT_BASED"
      });
      expect(screen.queryByText("Check the highlighted fields and try again.")).not.toBeInTheDocument();
    });
  });

  it("shows duplicate name conflicts next to the name field and preserves form values", async () => {
    vi.mocked(createWorkType).mockRejectedValue(workTypeNameExistsError());
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Check");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findAllByText("A work type with this name already exists.")).toHaveLength(2);
    expect(screen.getByDisplayValue("Check")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows backend validation and preserves form values", async () => {
    vi.mocked(createWorkType).mockRejectedValue(validationError());
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Check");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findAllByText("Name already exists")).toHaveLength(2);
    expect(screen.getByDisplayValue("Check")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("prevents double submit while saving", async () => {
    vi.mocked(createWorkType).mockReturnValue(new Promise(() => undefined));
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Check");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByRole("button", { name: /saving/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /saving/i }));

    expect(createWorkType).toHaveBeenCalledTimes(1);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  createUnitType: vi.fn(),
  createWorkType: vi.fn(),
  deleteUnitType: vi.fn(),
  deleteWorkType: vi.fn(),
  getWorkType: vi.fn(),
  listUnitTypes: vi.fn(),
  updateUnitType: vi.fn(),
  updateWorkType: vi.fn()
}));

vi.mock("../hooks/use-unsaved-changes-guard", () => ({
  useUnsavedChangesGuard: () => ({
    confirmOrRun: (action: () => void) => action(),
    dialog: null
  })
}));

import {
  createUnitType,
  createWorkType,
  deleteUnitType,
  deleteWorkType,
  getWorkType,
  listUnitTypes,
  updateUnitType,
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
    vi.mocked(createUnitType).mockResolvedValue({
      id: "unit-type-1",
      workTypeId: "work-type-1",
      name: "NORMAL",
      unitsPerHour: "2.4",
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
    vi.mocked(updateUnitType).mockImplementation(async (workTypeId, unitTypeId, payload) => ({
      id: unitTypeId,
      workTypeId,
      name: payload.name,
      unitsPerHour: String(payload.unitsPerHour),
      displayOrder: payload.displayOrder ?? 0,
      active: payload.active
    }));
    vi.mocked(deleteWorkType).mockResolvedValue(undefined);
    vi.mocked(deleteUnitType).mockResolvedValue(undefined);
  });

  it("creates a time-based work type and returns to the list", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "check");
    expect(screen.getByDisplayValue("CHECK")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalled();
      expect(vi.mocked(createWorkType).mock.calls[0][0]).toEqual({
        name: "CHECK",
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
        name: "CAMERE",
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
        name: "ROOMS",
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
    expect(screen.getByDisplayValue("CHECK")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows backend validation and preserves form values", async () => {
    vi.mocked(createWorkType).mockRejectedValue(validationError());
    renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Check");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findAllByText("Name already exists")).toHaveLength(2);
    expect(screen.getByDisplayValue("CHECK")).toBeInTheDocument();
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

  it("hides the status field and preserves existing active state on update", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 3,
      active: false
    });
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByDisplayValue("ROOMS")).toBeInTheDocument();
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "president");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateWorkType).toHaveBeenCalledWith("work-type-1", expect.objectContaining({
        name: "PRESIDENT",
        active: false
      }));
    });
  });

  it("creates a unit type in a centered dialog from the work type detail page", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    vi.mocked(listUnitTypes).mockResolvedValue([]);
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "ROOMS" });
    await user.click(screen.getByRole("button", { name: "Add first unit type" }));

    const dialog = screen.getByRole("dialog", { name: "Add unit type" });
    expect(dialog).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Name"), "Normal");
    await user.type(within(dialog).getByLabelText("Units per hour"), "2,4");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createUnitType).toHaveBeenCalledWith("work-type-1", {
        name: "Normal",
        unitsPerHour: 2.4,
        active: true
      });
      expect(navigateMock).not.toHaveBeenCalledWith("/settings/work-types/work-type-1/unit-types/new");
    });
  });

  it("edits an existing unit type in the same centered dialog", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    vi.mocked(listUnitTypes).mockResolvedValue([
      {
        id: "unit-normal",
        workTypeId: "work-type-1",
        name: "NORMAL",
        unitsPerHour: "2.4",
        displayOrder: 7,
        active: true
      }
    ]);
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("2.4")).toBeInTheDocument();
    expect(screen.queryByText("2.4 / hour")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Edit NORMAL" }));

    const dialog = screen.getByRole("dialog", { name: "Edit unit type" });
    expect(within(dialog).getByDisplayValue("NORMAL")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("2.4")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Units per hour"));
    await user.type(within(dialog).getByLabelText("Units per hour"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateUnitType).toHaveBeenCalledWith("work-type-1", "unit-normal", {
        name: "NORMAL",
        unitsPerHour: 3,
        displayOrder: 7,
        active: true
      });
      expect(navigateMock).not.toHaveBeenCalledWith("/settings/work-types/work-type-1/unit-types/unit-normal");
    });
  });

  it("updates the color for a unit-based work type from its detail page", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    vi.mocked(listUnitTypes).mockResolvedValue([]);
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "ROOMS" });
    await user.click(screen.getByRole("button", { name: "Color #34D399" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateWorkType).toHaveBeenCalledWith("work-type-1", expect.objectContaining({
        color: "#34D399"
      }));
    });
  });

  it("moves unit types by swapping display order", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    vi.mocked(listUnitTypes).mockResolvedValue([
      {
        id: "unit-normal",
        workTypeId: "work-type-1",
        name: "NORMAL",
        unitsPerHour: "2.4",
        displayOrder: 0,
        active: true
      },
      {
        id: "unit-junior",
        workTypeId: "work-type-1",
        name: "JUNIOR",
        unitsPerHour: "1.8",
        displayOrder: 1,
        active: true
      }
    ]);
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("button", { name: "Edit NORMAL" });
    await user.click(screen.getByRole("button", { name: "Move JUNIOR up" }));

    await waitFor(() => {
      expect(updateUnitType).toHaveBeenNthCalledWith(1, "work-type-1", "unit-junior", {
        name: "JUNIOR",
        unitsPerHour: 1.8,
        displayOrder: 0,
        active: true
      });
      expect(updateUnitType).toHaveBeenNthCalledWith(2, "work-type-1", "unit-normal", {
        name: "NORMAL",
        unitsPerHour: 2.4,
        displayOrder: 1,
        active: true
      });
    });
  });

  it("deactivates an existing unit type from the edit dialog", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    vi.mocked(listUnitTypes).mockResolvedValue([
      {
        id: "unit-normal",
        workTypeId: "work-type-1",
        name: "NORMAL",
        unitsPerHour: "2.4",
        displayOrder: 7,
        active: true
      }
    ]);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Edit NORMAL" }));
    const dialog = screen.getByRole("dialog", { name: "Edit unit type" });
    await user.click(within(dialog).getByRole("button", { name: "Deactivate unit type" }));

    await waitFor(() => {
      expect(deleteUnitType).toHaveBeenCalledWith("work-type-1", "unit-normal");
    });
  });
});

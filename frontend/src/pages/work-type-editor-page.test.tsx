import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkTypeEditorPage } from "./work-type-editor-page";

const navigateMock = vi.fn();
const routeState: { workTypeId?: string; setupMode?: string; calculationMethod?: string; compensationMethod?: string; search?: string } = {};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({
      search: routeState.search ?? "",
      state: routeState.setupMode
        ? {
          setupMode: routeState.setupMode,
          calculationMethod: routeState.calculationMethod,
          compensationMethod: routeState.compensationMethod
        }
        : null
    }),
    useParams: () => (routeState.workTypeId ? { workTypeId: routeState.workTypeId } : {})
  };
});

vi.mock("../api/endpoints", () => ({
  createWorkType: vi.fn(),
  deleteWorkType: vi.fn(),
  getWorkType: vi.fn(),
  listEmployments: vi.fn(),
  listWorkTypes: vi.fn(),
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
  listEmployments,
  listWorkTypes,
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

async function chooseSetupMode(user: ReturnType<typeof userEvent.setup>, name: RegExp | string) {
  await user.click(await screen.findByRole("button", { name }));
}

describe("WorkTypeEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.workTypeId = undefined;
    routeState.setupMode = undefined;
    routeState.calculationMethod = undefined;
    routeState.compensationMethod = undefined;
    routeState.search = undefined;
    navigateMock.mockReset();
    vi.mocked(listEmployments).mockResolvedValue([{
      id: "employment-1",
      name: "Primary employment",
      employmentType: null,
      compensationType: "HOURLY",
      trackingFocus: "EARNINGS",
      hourBalanceEnabled: false,
      termsValidFrom: "2026-01-01",
      startDate: null,
      endDate: null,
      fixedSalaryAmount: null,
      currency: null,
      targetMinutes: null,
      targetPeriod: null,
      hourBalanceValidityMonths: null,
      active: true,
      displayOrder: 0,
      deletable: true
    }]);
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
    vi.mocked(listWorkTypes).mockResolvedValue([]);
    vi.mocked(createWorkType).mockImplementation(async (payload) => ({
      id: "work-type-1",
      name: payload.name,
      parentId: payload.parentId ?? null,
      calculationMethod: payload.calculationMethod,
      compensationMethod: payload.compensationMethod ?? null,
      unitLabel: payload.unitLabel ?? null,
      unitSymbol: payload.unitSymbol ?? null,
      unitsPerHour: payload.unitsPerHour == null ? null : String(payload.unitsPerHour),
      ratePerUnit: payload.ratePerUnit == null ? null : String(payload.ratePerUnit),
      currency: payload.currency ?? null,
      teamworkEnabled: payload.teamworkEnabled ?? false,
      extraPayEnabled: payload.extraPayEnabled ?? false,
      compositeEnabled: payload.compositeEnabled ?? false,
      color: payload.color ?? "#FFFFFF",
      icon: payload.icon ?? null,
      defaultBreakMinutes: payload.defaultBreakMinutes ?? null,
      displayOrder: payload.displayOrder ?? 0,
      active: true
    }));
    vi.mocked(updateWorkType).mockImplementation(async (id, payload) => ({
      id,
      name: payload.name,
      parentId: payload.parentId ?? null,
      calculationMethod: payload.calculationMethod,
      compensationMethod: payload.compensationMethod ?? null,
      unitLabel: payload.unitLabel ?? null,
      unitSymbol: payload.unitSymbol ?? null,
      unitsPerHour: payload.unitsPerHour == null ? null : String(payload.unitsPerHour),
      ratePerUnit: payload.ratePerUnit == null ? null : String(payload.ratePerUnit),
      currency: payload.currency ?? null,
      teamworkEnabled: payload.teamworkEnabled ?? false,
      extraPayEnabled: payload.extraPayEnabled ?? false,
      compositeEnabled: payload.compositeEnabled ?? false,
      color: payload.color ?? "#FFFFFF",
      icon: payload.icon ?? null,
      defaultBreakMinutes: payload.defaultBreakMinutes ?? null,
      displayOrder: payload.displayOrder ?? 0,
      active: payload.active
    }));
    vi.mocked(deleteWorkType).mockResolvedValue(undefined);
  });

  it("creates a time-based work type and returns to the list", async () => {
    renderPage();
    const user = userEvent.setup();

    await chooseSetupMode(user, /time based/i);
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "check");
    await user.click(screen.getByLabelText("Extra pay"));
    expect(screen.getByDisplayValue("check")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalled();
	      expect(vi.mocked(createWorkType).mock.calls[0][0]).toEqual(expect.objectContaining({
	        name: "check",
	        calculationMethod: "TIME_BASED",
	        color: "#A3E635",
	        icon: null,
	        defaultBreakMinutes: 30,
          extraPayEnabled: true
	      }));
      expect(navigateMock).toHaveBeenCalledWith("/settings/work-types", { replace: true });
    });
  });

  it("opens the time-based form when the modal sends time-based state", async () => {
    routeState.search = "?mode=TIME_HOURLY";
    routeState.setupMode = "TIME_HOURLY";
    routeState.calculationMethod = "TIME_BASED";
    routeState.compensationMethod = "HOURLY";

    renderPage();

    expect(await screen.findByRole("heading", { name: "Add work type" })).toBeInTheDocument();
    expect(screen.getByText("Time based")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Default break")).toBeInTheDocument();
    expect(screen.getByLabelText("Teamwork")).toBeInTheDocument();
    expect(screen.getByLabelText("Extra pay")).toBeInTheDocument();
    expect(screen.getByLabelText("Advanced")).toBeInTheDocument();
    expect(screen.queryByText("Fixed price")).not.toBeInTheDocument();
  });

  it("opens the fixed-price form when the modal sends fixed-price mode", async () => {
    routeState.search = "?mode=FIXED_AMOUNT";
    routeState.setupMode = "FIXED_AMOUNT";
    routeState.calculationMethod = "FIXED_PRICE_BASED";
    routeState.compensationMethod = "HOURLY";

    renderPage();

    expect(await screen.findByRole("heading", { name: "Add work type" })).toBeInTheDocument();
    expect(screen.getByText("Fixed price")).toBeInTheDocument();
    expect(screen.queryByText("Time based")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Default break")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Unit name")).not.toBeInTheDocument();
  });

  it("uses the URL mode before stale navigation state", async () => {
    routeState.search = "?mode=TIME_HOURLY";
    routeState.setupMode = "FIXED_AMOUNT";
    routeState.calculationMethod = "FIXED_PRICE_BASED";
    routeState.compensationMethod = "HOURLY";

    renderPage();

    expect(await screen.findByRole("heading", { name: "Add work type" })).toBeInTheDocument();
    expect(screen.getByText("Time based")).toBeInTheDocument();
    expect(screen.getByLabelText("Default break")).toBeInTheDocument();
    expect(screen.queryByText("Fixed price")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Check");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalledWith(expect.objectContaining({
        name: "Check",
        calculationMethod: "TIME_BASED",
        compensationMethod: "HOURLY",
        defaultBreakMinutes: 30
      }));
    });
  });

  it("shows child time-based name and default break in the same block row", async () => {
    routeState.search = "?mode=TIME_HOURLY";
    routeState.setupMode = "TIME_HOURLY";
    routeState.calculationMethod = "TIME_BASED";
    routeState.compensationMethod = "HOURLY";

    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText("Advanced"));

    expect(screen.getByLabelText("Category name")).toBeInTheDocument();
    const childNameField = screen.getByLabelText("Name");
    const defaultBreakFields = screen.getAllByLabelText("Default break");
    const childDefaultBreakField = defaultBreakFields[0];

    expect(childNameField.closest(".grid")).toBe(childDefaultBreakField.closest(".grid"));
  });

  it("keeps time-based advanced parent fields and lets children define their default break", async () => {
    routeState.search = "?mode=TIME_HOURLY";
    routeState.setupMode = "TIME_HOURLY";
    routeState.calculationMethod = "TIME_BASED";
    routeState.compensationMethod = "HOURLY";

    renderPage();
    const user = userEvent.setup();

    await user.clear(await screen.findByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Daily work");
    await user.click(screen.getByLabelText("Teamwork"));
    await user.click(screen.getByLabelText("Advanced"));

    expect(screen.getByLabelText("Category name")).toBeInTheDocument();
    expect(screen.getByLabelText("Teamwork")).toBeInTheDocument();
    expect(screen.getByLabelText("Advanced")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Name")).toHaveLength(1);
    expect(screen.getAllByLabelText("Default break")).toHaveLength(1);

    await user.type(screen.getByLabelText("Name"), "Check");
    const childBreakField = screen.getByLabelText("Default break");
    await user.clear(childBreakField);
    await user.type(childBreakField, "15");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalledWith(expect.objectContaining({
        name: "Daily work",
        calculationMethod: "TIME_BASED",
        teamworkEnabled: true,
        compositeEnabled: true,
        color: "#A3E635",
        defaultBreakMinutes: null
      }));
      expect(createWorkType).toHaveBeenCalledWith(expect.objectContaining({
        parentId: "work-type-1",
        name: "Check",
        calculationMethod: "TIME_BASED",
        teamworkEnabled: true,
        color: "#A3E635",
        defaultBreakMinutes: 15
      }));
    });
  });

  it("opens unit setup after creating a unit-based work type", async () => {
    vi.mocked(createWorkType).mockResolvedValue({
      id: "work-type-unit",
      name: "Camere",
      calculationMethod: "UNITS_PER_HOUR_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    renderPage();
    const user = userEvent.setup();

    await chooseSetupMode(user, /units converted to hours/i);
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Camere");
    await user.type(screen.getByLabelText("Unit name"), "Room");
    await user.type(screen.getByLabelText("Units per hour"), "2,4");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
	      expect(vi.mocked(createWorkType).mock.calls[0][0]).toEqual(expect.objectContaining({
	        name: "Camere",
	        calculationMethod: "UNITS_PER_HOUR_BASED",
          unitLabel: "Room",
          unitsPerHour: 2.4,
	        color: "#A3E635",
	        icon: null,
	        defaultBreakMinutes: null
	      }));
      expect(navigateMock).toHaveBeenCalledWith("/settings/work-types", { replace: true });
    });
  });

  it("creates a unit-based work type when hidden active value is absent", async () => {
    vi.mocked(createWorkType).mockResolvedValue({
      id: "work-type-unit",
      name: "Rooms",
      calculationMethod: "UNITS_PER_HOUR_BASED",
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    renderPage();
    const user = userEvent.setup();

    await chooseSetupMode(user, /units converted to hours/i);
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Rooms");
    await user.type(screen.getByLabelText("Unit name"), "Room");
    await user.type(screen.getByLabelText("Units per hour"), "2");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
	      expect(createWorkType).toHaveBeenCalledWith(expect.objectContaining({
	        name: "Rooms",
	        calculationMethod: "UNITS_PER_HOUR_BASED",
          unitLabel: "Room",
          unitsPerHour: 2,
	        color: "#A3E635",
	        icon: null,
	        defaultBreakMinutes: null
	      }));
      expect(screen.queryByText("Check the highlighted fields and try again.")).not.toBeInTheDocument();
    });
  });

  it("treats advanced work types as parent-only containers", async () => {
    renderPage();
    const user = userEvent.setup();

    await chooseSetupMode(user, /units converted to hours/i);
    expect(screen.getByLabelText("Unit name")).toBeInTheDocument();
    expect(screen.getByLabelText("Symbol")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Advanced"));

    expect(screen.getByLabelText("Unit name")).toBeInTheDocument();
    expect(screen.getByLabelText("Symbol")).toBeInTheDocument();
    expect(screen.getByLabelText("Units per hour")).toBeInTheDocument();
    expect(screen.getByLabelText("Teamwork")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Category name"));
    await user.type(screen.getByLabelText("Category name"), "Floor heating");
    await user.type(screen.getByLabelText("Name"), "Normal");
    await user.type(screen.getByLabelText("Unit name"), "m2");
    await user.type(screen.getByLabelText("Units per hour"), "2");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalledWith(expect.objectContaining({
        name: "Floor heating",
        calculationMethod: "UNITS_PER_HOUR_BASED",
        unitLabel: null,
        unitSymbol: null,
        unitsPerHour: null,
        ratePerUnit: null,
        currency: null,
        teamworkEnabled: false,
        compositeEnabled: true
      }));
      expect(createWorkType).toHaveBeenCalledWith(expect.objectContaining({
        parentId: "work-type-1",
        name: "Normal",
        calculationMethod: "UNITS_PER_HOUR_BASED",
        unitLabel: "m2",
        unitsPerHour: 2
      }));
    });
  });

  it("creates a fixed-price work type with only the relevant fields", async () => {
    renderPage();
    const user = userEvent.setup();

    await chooseSetupMode(user, /fixed price/i);
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Roof repair");
    expect(screen.queryByLabelText("Unit name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Rate per unit")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Default break")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalledWith(expect.objectContaining({
        name: "Roof repair",
        calculationMethod: "FIXED_PRICE_BASED",
        compensationMethod: "HOURLY",
        unitLabel: null,
        unitSymbol: null,
        unitsPerHour: null,
        ratePerUnit: null,
        currency: null,
        defaultBreakMinutes: null
      }));
    });
  });

  it("does not show unit fields for fixed-price advanced children", async () => {
    routeState.search = "?mode=FIXED_AMOUNT";
    routeState.setupMode = "FIXED_AMOUNT";
    routeState.calculationMethod = "FIXED_PRICE_BASED";
    routeState.compensationMethod = "HOURLY";

    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Fixed price")).toBeInTheDocument();
    expect(screen.queryByLabelText("Unit name")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Advanced"));

    expect(screen.getByLabelText("Category name")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Name")).toHaveLength(1);
    expect(screen.queryByLabelText("Unit name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Symbol")).not.toBeInTheDocument();
  });

  it("shows duplicate name conflicts next to the name field and preserves form values", async () => {
    vi.mocked(createWorkType).mockRejectedValue(workTypeNameExistsError());
    renderPage();
    const user = userEvent.setup();

    await chooseSetupMode(user, /time based/i);
    await user.clear(screen.getByLabelText("Name"));
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

    await chooseSetupMode(user, /time based/i);
    await user.clear(screen.getByLabelText("Name"));
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

    await chooseSetupMode(user, /time based/i);
    await user.clear(screen.getByLabelText("Name"));
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
      unitLabel: "Room",
      unitSymbol: null,
      unitsPerHour: null,
      ratePerUnit: "50.0000",
      currency: "EUR",
      teamworkEnabled: false,
      compositeEnabled: false,
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
        name: "president",
        active: false
      }));
    });
  });

  it("creates a work formula from the work type detail page", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      unitLabel: "Room",
      unitSymbol: null,
      unitsPerHour: null,
      ratePerUnit: "50.0000",
      currency: "EUR",
      teamworkEnabled: false,
      compositeEnabled: true,
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "ROOMS" });
    await user.click(screen.getByRole("button", { name: "Add work type" }));

    const dialog = screen.getByRole("dialog", { name: "Add formula" });
    expect(dialog).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Activity name"), "Normal rooms");
    await user.click(within(dialog).getByRole("button", { name: /Units \/ units per hour/i }));
    await user.type(within(dialog).getByLabelText("Unit name"), "Room");
    await user.type(within(dialog).getByLabelText("Units per hour"), "2,4");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalledWith(expect.objectContaining({
        parentId: "work-type-1",
        name: "Normal rooms",
        calculationMethod: "UNITS_PER_HOUR_BASED",
        unitLabel: "Room",
        unitsPerHour: 2.4,
        color: "#FFFFFF",
        active: true
      }));
    });
  });

  it("edits an existing work formula in the same centered dialog", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      unitLabel: "Room",
      unitSymbol: null,
      unitsPerHour: null,
      ratePerUnit: "50.0000",
      currency: "EUR",
      teamworkEnabled: false,
      compositeEnabled: true,
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    vi.mocked(listWorkTypes).mockResolvedValue([
      {
        id: "config-normal",
        parentId: "work-type-1",
        name: "Normal rooms",
        calculationMethod: "UNITS_PER_HOUR_BASED",
        unitLabel: "Room",
        unitSymbol: null,
        unitsPerHour: "2.4",
        ratePerUnit: null,
        currency: null,
        teamworkEnabled: false,
        compositeEnabled: false,
        color: "#FFFFFF",
        icon: null,
        defaultBreakMinutes: null,
        displayOrder: 7,
        active: true
      }
    ]);
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("2.4 Room per hour")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /normal rooms/i }));

    const dialog = screen.getByRole("dialog", { name: "Edit formula" });
    expect(within(dialog).getByDisplayValue("Normal rooms")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("2.4")).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Units per hour"));
    await user.type(within(dialog).getByLabelText("Units per hour"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateWorkType).toHaveBeenCalledWith("config-normal", expect.objectContaining({
        parentId: "work-type-1",
        name: "Normal rooms",
        calculationMethod: "UNITS_PER_HOUR_BASED",
        unitLabel: "Room",
        unitsPerHour: 3,
        displayOrder: 7,
        active: true
      }));
    });
  });

  it("lets the user choose a color for a new work type", async () => {
    renderPage();
    const user = userEvent.setup();

    await chooseSetupMode(user, /time based/i);
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Check");
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#60A5FA" } });
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(createWorkType).toHaveBeenCalledWith(expect.objectContaining({
        name: "Check",
        color: "#60a5fa"
      }));
    });
  });

  it("keeps the existing color on the edit page", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      unitLabel: "Room",
      unitSymbol: null,
      unitsPerHour: null,
      ratePerUnit: "50.0000",
      currency: "EUR",
      teamworkEnabled: false,
      compositeEnabled: false,
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "ROOMS" });
    expect(screen.getByLabelText("Color")).toHaveValue("#ffffff");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateWorkType).toHaveBeenCalledWith("work-type-1", expect.objectContaining({
        color: "#FFFFFF"
      }));
    });
  });

  it("saves an existing time-based work type when the hidden color is missing", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "CHECK",
      calculationMethod: "TIME_BASED",
      unitLabel: null,
      unitSymbol: null,
      unitsPerHour: null,
      ratePerUnit: null,
      currency: null,
      teamworkEnabled: false,
      compositeEnabled: false,
      color: null as unknown as string,
      icon: null,
      defaultBreakMinutes: 30,
      displayOrder: 0,
      active: true
    });
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "CHECK" });
    expect(screen.getByLabelText("Color")).toHaveValue("#a3e635");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateWorkType).toHaveBeenCalledWith("work-type-1", expect.objectContaining({
        name: "CHECK",
        calculationMethod: "TIME_BASED",
        color: "#A3E635",
        defaultBreakMinutes: 30
      }));
    });
    expect(screen.queryByText("Check the highlighted fields and try again.")).not.toBeInTheDocument();
  });

  it("shows delete for an unused work type", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "CHECK",
      calculationMethod: "TIME_BASED",
      unitLabel: null,
      unitSymbol: null,
      unitsPerHour: null,
      ratePerUnit: null,
      currency: null,
      teamworkEnabled: false,
      compositeEnabled: false,
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: 30,
      displayOrder: 0,
      active: true,
      deletable: true
    });
    renderPage();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "CHECK" });
    await user.click(screen.getByRole("button", { name: "Delete work type" }));

    expect(screen.getByRole("dialog", { name: "Delete work type?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteWorkType).toHaveBeenCalledWith("work-type-1");
    });
  });

  it("shows deactivate for a work type with saved records", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "CHECK",
      calculationMethod: "TIME_BASED",
      unitLabel: null,
      unitSymbol: null,
      unitsPerHour: null,
      ratePerUnit: null,
      currency: null,
      teamworkEnabled: false,
      compositeEnabled: false,
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: 30,
      displayOrder: 0,
      active: true,
      deletable: false
    });
    renderPage();

    await screen.findByRole("heading", { name: "CHECK" });

    expect(screen.getByRole("button", { name: "Deactivate work type" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete work type" })).not.toBeInTheDocument();
  });

  it("deactivates an existing work formula from the edit dialog", async () => {
    routeState.workTypeId = "work-type-1";
    vi.mocked(getWorkType).mockResolvedValue({
      id: "work-type-1",
      name: "ROOMS",
      calculationMethod: "UNIT_BASED",
      unitLabel: "Room",
      unitSymbol: null,
      unitsPerHour: null,
      ratePerUnit: "50.0000",
      currency: "EUR",
      teamworkEnabled: false,
      compositeEnabled: true,
      color: "#FFFFFF",
      icon: null,
      defaultBreakMinutes: null,
      displayOrder: 0,
      active: true
    });
    vi.mocked(listWorkTypes).mockResolvedValue([
      {
        id: "config-normal",
        parentId: "work-type-1",
        name: "Normal rooms",
        calculationMethod: "UNITS_PER_HOUR_BASED",
        unitLabel: "Room",
        unitSymbol: null,
        unitsPerHour: "2.4",
        ratePerUnit: null,
        currency: null,
        teamworkEnabled: false,
        compositeEnabled: false,
        color: "#FFFFFF",
        icon: null,
        defaultBreakMinutes: null,
        displayOrder: 7,
        active: true
      }
    ]);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /normal rooms/i }));
    const dialog = screen.getByRole("dialog", { name: "Edit formula" });
    await user.click(within(dialog).getByRole("button", { name: "Deactivate formula" }));

    await waitFor(() => {
      expect(deleteWorkType).toHaveBeenCalledWith("config-normal");
    });
  });
});

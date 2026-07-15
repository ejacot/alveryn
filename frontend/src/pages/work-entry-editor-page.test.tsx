import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkEntryEditorPage } from "./work-entry-editor-page";

const navigateMock = vi.fn();
const routeState: {
  entryId?: string;
  selectedDate: Date;
  locationState?: { returnTo?: string } | null;
  search?: string;
} = {
  selectedDate: new Date("2026-07-13T00:00:00")
};

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => (routeState.entryId ? { entryId: routeState.entryId } : {}),
    useOutletContext: () => ({ selectedDate: routeState.selectedDate }),
    useLocation: () => ({ state: routeState.locationState ?? null }),
    useSearchParams: () => [new URLSearchParams(routeState.search ?? "")]
  };
});

vi.mock("../api/endpoints", () => ({
  createWorkEntry: vi.fn(),
  deleteWorkEntry: vi.fn(),
  getWorkEntry: vi.fn(),
  listHourlyRates: vi.fn(),
  listUnitTypes: vi.fn(),
  listWorkTypes: vi.fn(),
  updateWorkEntry: vi.fn()
}));

vi.mock("../components/work-entry/work-type-picker", () => ({
  WorkTypePicker: ({
    workTypes,
    onChange
  }: {
    workTypes: Array<{ id: string; name: string }>;
    onChange: (workTypeId: string) => void;
  }) => (
    <div>
      {workTypes.map((workType) => (
        <button key={workType.id} type="button" onClick={() => onChange(workType.id)}>
          {workType.name}
        </button>
      ))}
    </div>
  )
}));

vi.mock("../components/work-entry/unit-item-rows", () => ({
  UnitItemRows: ({
    unitTypes,
    register
  }: {
    unitTypes: Array<{ id: string; name: string }>;
    register: (
      name: "unitItems.0.unitTypeId" | "unitItems.0.quantity",
      options?: unknown
    ) => Record<string, unknown>;
  }) => (
    <div>
      <input type="hidden" value={unitTypes[0]?.id ?? ""} {...register("unitItems.0.unitTypeId")} />
      <label>
        {unitTypes[0]?.name ?? "Units"}
        <input type="number" {...register("unitItems.0.quantity")} />
      </label>
    </div>
  )
}));

vi.mock("../hooks/use-unsaved-changes-guard", () => ({
  useUnsavedChangesGuard: () => ({
    confirmOrRun: (action: () => void) => action(),
    dialog: null
  })
}));

import {
  createWorkEntry,
  deleteWorkEntry,
  getWorkEntry,
  listHourlyRates,
  listUnitTypes,
  listWorkTypes,
  updateWorkEntry
} from "../api/endpoints";

const workTypes = [
  {
    id: "wt-time",
    name: "Regular Shift",
    calculationMethod: "TIME_BASED" as const,
    color: "#FFFFFF",
    icon: "R",
    defaultBreakMinutes: 30,
    displayOrder: 0,
    active: true
  },
  {
    id: "wt-unit",
    name: "Orders",
    calculationMethod: "UNIT_BASED" as const,
    color: "#D4D4D8",
    icon: "O",
    defaultBreakMinutes: null,
    displayOrder: 1,
    active: true
  }
];

const hourlyRates = [
  {
    id: "rate-1",
    hourlyRate: "20",
    currency: "EUR",
    validFrom: "2026-01-01",
    validTo: null
  }
];

const unitTypes = [
  {
    id: "unit-1",
    workTypeId: "wt-unit",
    name: "Orders",
    unitsPerHour: "30",
    displayOrder: 0,
    active: true
  }
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkEntryEditorPage />
    </QueryClientProvider>
  );
}

describe("WorkEntryEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeState.entryId = undefined;
    routeState.selectedDate = new Date("2026-07-13T12:00:00");
    routeState.locationState = null;
    routeState.search = "";
    navigateMock.mockReset();
    vi.mocked(listWorkTypes).mockResolvedValue(workTypes);
    vi.mocked(listHourlyRates).mockResolvedValue(hourlyRates);
    vi.mocked(listUnitTypes).mockResolvedValue(unitTypes);
    vi.mocked(getWorkEntry).mockResolvedValue({
      id: "entry-1",
      workTypeId: "wt-time",
      workTypeName: "Regular Shift",
      calculationMethod: "TIME_BASED",
      workDate: "2026-07-13",
      hourlyRateSnapshot: "20",
      currencySnapshot: "EUR",
      calculatedMinutes: "450",
      workedHours: "7.5",
      grossAmount: "150",
      notes: "Existing note",
      timeEntry: {
        startTime: "08:00",
        endTime: "16:00",
        breakMinutes: 30,
        totalIntervalMinutes: 480,
        workedMinutes: 450
      },
      unitItems: [],
      createdAt: "2026-07-13T09:00:00Z",
      updatedAt: "2026-07-13T09:00:00Z"
    });
    vi.mocked(createWorkEntry).mockResolvedValue({
      id: "entry-2",
      workTypeId: "wt-time",
      workTypeName: "Regular Shift",
      calculationMethod: "TIME_BASED",
      workDate: "2026-07-13",
      hourlyRateSnapshot: "20",
      currencySnapshot: "EUR",
      calculatedMinutes: "450",
      workedHours: "7.5",
      grossAmount: "150",
      notes: null,
      timeEntry: {
        startTime: "09:00",
        endTime: "17:00",
        breakMinutes: 30,
        totalIntervalMinutes: 480,
        workedMinutes: 450
      },
      unitItems: [],
      createdAt: "2026-07-13T09:00:00Z",
      updatedAt: "2026-07-13T09:00:00Z"
    });
    vi.mocked(updateWorkEntry).mockResolvedValue({
      id: "entry-1",
      workTypeId: "wt-time",
      workTypeName: "Regular Shift",
      calculationMethod: "TIME_BASED",
      workDate: "2026-07-13",
      hourlyRateSnapshot: "20",
      currencySnapshot: "EUR",
      calculatedMinutes: "510",
      workedHours: "8.5",
      grossAmount: "170",
      notes: "Existing note",
      timeEntry: {
        startTime: "08:00",
        endTime: "17:00",
        breakMinutes: 30,
        totalIntervalMinutes: 540,
        workedMinutes: 510
      },
      unitItems: [],
      createdAt: "2026-07-13T09:00:00Z",
      updatedAt: "2026-07-13T10:00:00Z"
    });
    vi.mocked(deleteWorkEntry).mockResolvedValue(undefined);
  });

  it("creates a unit-based entry", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /orders/i }));
    fireEvent.change(screen.getByLabelText("Work date"), {
      target: { value: "2026-07-13" }
    });
    await user.clear(screen.getByLabelText("Orders"));
    await user.type(screen.getByLabelText("Orders"), "12");
    await user.click(screen.getByRole("button", { name: /save entry/i }));

    await waitFor(() => {
      expect(createWorkEntry).toHaveBeenCalled();
      expect(vi.mocked(createWorkEntry).mock.calls[0][0]).toEqual({
        workTypeId: "wt-unit",
        workDate: "2026-07-13",
        notes: null,
        unitItems: [{ unitTypeId: "unit-1", quantity: 12 }]
      });
    });
  });

  it("creates a time-based entry without requiring hidden unit rows", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /regular shift/i }));
    fireEvent.change(screen.getByLabelText("Work date"), {
      target: { value: "2026-07-13" }
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "08:00" }
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "16:00" }
    });
    fireEvent.change(screen.getByLabelText("Break (minutes)"), {
      target: { value: "30" }
    });
    await user.click(screen.getByRole("button", { name: /save entry/i }));

    await waitFor(() => {
      expect(createWorkEntry).toHaveBeenCalled();
      expect(vi.mocked(createWorkEntry).mock.calls[0][0]).toEqual({
        workTypeId: "wt-time",
        workDate: "2026-07-13",
        notes: null,
        startTime: "08:00",
        endTime: "16:00",
        unpaidBreakMinutes: 30
      });
    });
  });

  it("shows overlap conflicts near time fields and keeps entered values", async () => {
    vi.mocked(createWorkEntry).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          timestamp: "2026-01-01T00:00:00Z",
          status: 409,
          message: "This work entry overlaps an existing activity from 09:00 to 17:00.",
          code: "WORK_ENTRY_TIME_OVERLAP",
          path: "/api/work-entries",
          errors: []
        }
      }
    });
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /regular shift/i }));
    fireEvent.change(screen.getByLabelText("Work date"), {
      target: { value: "2026-07-13" }
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "14:00" }
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "19:00" }
    });
    fireEvent.change(screen.getByLabelText("Break (minutes)"), {
      target: { value: "30" }
    });

    await new Promise((resolve) => window.setTimeout(resolve, 600));
    navigateMock.mockClear();
    await user.click(screen.getByRole("button", { name: /save entry/i }));

    expect(
      await screen.findByText("This activity overlaps an existing activity from 09:00 to 17:00.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Start")).toHaveValue("14:00");
    expect(screen.getByLabelText("End")).toHaveValue("19:00");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("deletes an existing entry after confirmation", async () => {
    routeState.entryId = "entry-1";
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /delete/i }));
    await screen.findByText("Delete this entry?");
    await user.click(screen.getAllByRole("button", { name: /^delete$/i })[1]);

    await waitFor(() => {
      expect(deleteWorkEntry).toHaveBeenCalledWith("entry-1");
    });
  });

  it("shows inline validation when no work type is selected", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /save entry/i }));

    expect(await screen.findByText("Choose a work type")).toBeInTheDocument();
    expect(createWorkEntry).not.toHaveBeenCalled();
  });

  it("prefills the work date from the calendar query string", async () => {
    routeState.search = "date=2026-07-21";
    renderPage();

    expect(await screen.findByDisplayValue("2026-07-21")).toBeInTheDocument();
  });

  it("keeps saved unit quantities while unit types load during edit", async () => {
    routeState.entryId = "entry-1";
    vi.mocked(getWorkEntry).mockResolvedValue({
      id: "entry-1",
      workTypeId: "wt-unit",
      workTypeName: "Orders",
      calculationMethod: "UNIT_BASED",
      workDate: "2026-07-13",
      hourlyRateSnapshot: "20",
      currencySnapshot: "EUR",
      calculatedMinutes: "10",
      workedHours: "0.17",
      grossAmount: "3.33",
      notes: null,
      timeEntry: null,
      unitItems: [
        {
          id: "item-1",
          unitTypeId: "unit-1",
          unitName: "Orders",
          quantity: "5",
          unitsPerHourSnapshot: "30",
          calculatedMinutes: "10"
        }
      ],
      createdAt: "2026-07-13T09:00:00Z",
      updatedAt: "2026-07-13T09:00:00Z"
    });
    let resolveUnitTypes: (value: typeof unitTypes) => void = () => undefined;
    vi.mocked(listUnitTypes).mockReturnValue(
      new Promise((resolve) => {
        resolveUnitTypes = resolve;
      })
    );

    renderPage();
    resolveUnitTypes(unitTypes);

    expect(await screen.findByDisplayValue("5")).toBeInTheDocument();
  });
});

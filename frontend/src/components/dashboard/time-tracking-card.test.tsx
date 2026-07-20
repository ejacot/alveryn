import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimeTrackingCard } from "./time-tracking-card";

vi.mock("../../api/endpoints", () => ({
  checkInToWorkSession: vi.fn(),
  checkOutOfWorkSession: vi.fn(),
  endWorkSessionPause: vi.fn(),
  getCurrentWorkSession: vi.fn(),
  listEmployments: vi.fn(),
  listWorkTypes: vi.fn(),
  startWorkSessionPause: vi.fn()
}));

import {
  checkInToWorkSession,
  getCurrentWorkSession,
  listEmployments,
  listWorkTypes,
  startWorkSessionPause
} from "../../api/endpoints";

const employment = {
  id: "employment-time",
  name: "Main contract",
  employmentType: null,
  compensationType: "FIXED_SALARY" as const,
  trackingFocus: "TIME" as const,
  hourBalanceEnabled: true,
  termsValidFrom: "2026-01-01",
  startDate: "2026-01-01",
  endDate: null,
  fixedSalaryAmount: "2000",
  currency: "EUR",
  targetMinutes: 9600,
  targetPeriod: "MONTHLY" as const,
  hourBalanceValidityMonths: 12,
  active: true,
  displayOrder: 0,
  deletable: false
};

const workType = {
  id: "work-type-time",
  employmentId: employment.id,
  parentId: null,
  name: "Regular shift",
  calculationMethod: "TIME_BASED" as const,
  compensationMethod: "HOURLY" as const,
  color: "#87C95A",
  icon: null,
  defaultBreakMinutes: 0,
  displayOrder: 0,
  active: true
};

function activeSession(defaultBreakMinutes = 0) {
  return {
    id: "session-1",
    employmentId: employment.id,
    employmentName: employment.name,
    workTypeId: workType.id,
    workTypeName: workType.name,
    defaultBreakMinutes,
    checkedInAt: new Date(Date.now() - 60 * 60 * 1_000).toISOString(),
    checkedOutAt: null,
    timezone: "Europe/Berlin",
    breakMinutes: 0,
    notes: null,
    workRecordId: null,
    pauseStartedAt: null,
    accumulatedBreakSeconds: 0,
    overdue: false
  };
}

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TimeTrackingCard />
    </QueryClientProvider>
  );
}

describe("TimeTrackingCard", () => {
  beforeEach(() => {
    window.localStorage.setItem("alveryn.employment-scope", "all");
    vi.mocked(listEmployments).mockResolvedValue([employment]);
    vi.mocked(listWorkTypes).mockResolvedValue([workType]);
    vi.mocked(getCurrentWorkSession).mockResolvedValue(null);
  });

  it("starts the only time-based work type without showing a selector", async () => {
    const session = activeSession();
    vi.mocked(checkInToWorkSession).mockResolvedValue(session);
    const user = userEvent.setup();
    renderCard();

    const checkIn = await screen.findByRole("button", { name: "Check in" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(checkIn);

    expect(checkInToWorkSession).toHaveBeenCalledWith({
      workTypeId: workType.id,
      timezone: expect.any(String)
    });
  });

  it("uses the automatic work-type break and hides manual break controls", async () => {
    vi.mocked(getCurrentWorkSession).mockResolvedValue(activeSession(30));
    vi.mocked(listWorkTypes).mockResolvedValue([{ ...workType, defaultBreakMinutes: 30 }]);
    renderCard();

    expect(await screen.findByText("30 min automatic break")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Break" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check out" })).toBeInTheDocument();
  });

  it("offers a tracked break when the work type default is zero", async () => {
    const session = activeSession();
    vi.mocked(getCurrentWorkSession).mockResolvedValue(session);
    vi.mocked(startWorkSessionPause).mockResolvedValue({
      ...session,
      pauseStartedAt: new Date().toISOString()
    });
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "Break" }));
    expect(startWorkSessionPause).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument());
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import {
  getPersonalBusinessSchedule,
  listMyBusinessAbsenceRequests,
} from "../api/endpoints";
import { SchedulePage } from "./schedule-page";

vi.mock("../api/endpoints", () => ({
  getPersonalBusinessSchedule: vi.fn(),
  listMyBusinessAbsenceRequests: vi.fn(),
  createMyBusinessAbsenceRequest: vi.fn(),
  checkInBusinessAssignment: vi.fn(),
  checkOutBusinessAssignment: vi.fn(),
}));

describe("SchedulePage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the privacy-minimised self schedule contract", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-10T12:00:00"));
    vi.mocked(listMyBusinessAbsenceRequests).mockResolvedValue([]);
    vi.mocked(getPersonalBusinessSchedule).mockResolvedValue([
      {
        organizationId: "organization-1",
        organizationName: "Hotel München",
        from: "2026-08-10",
        to: "2026-08-16",
        assignments: [
          {
            id: "assignment-1",
            date: "2026-08-10",
            unitId: "unit-1",
            unitName: "Housekeeping",
            workTypeId: "work-type-1",
            workTypeCode: "ROOM",
            workTypeName: "Room cleaning",
            color: "#10B981",
            startTime: "09:00:00",
            endTime: "16:30:00",
            checkInMode: "DISABLED",
            result: null,
          },
        ],
        dayEntries: [],
      },
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <SchedulePage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Hotel München")).toBeInTheDocument();
    expect(screen.getByText("ROOM · Room cleaning")).toBeInTheDocument();
    expect(screen.queryByText(/colleague/i)).not.toBeInTheDocument();
  });
});

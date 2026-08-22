import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamHours } from "./business-people-page";
import type { TeamMemberHours } from "../types/business";

const report: TeamMemberHours = { membershipId: "private-id", memberName: "Ana", from: "2026-08-01", to: "2026-08-31", daysWorked: 2, plannedMinutes: 960, workedMinutes: 870, days: [{ date: "2026-08-10", plannedMinutes: 480, workedMinutes: 450, completedSessions: 1, openSessions: 1, incompleteSessions: 1, correctedSessions: 1 }], weeks: [{ startDate: "2026-08-10", endDate: "2026-08-16", plannedMinutes: 960, workedMinutes: 870 }], months: [{ startDate: "2026-08-01", endDate: "2026-08-31", plannedMinutes: 960, workedMinutes: 870 }] };

describe("TeamHours", () => {
  it("covers loading, empty, permission error, selected period, totals and session states without technical identifiers", async () => {
    const user = userEvent.setup(); const onPeriod = vi.fn();
    const { rerender } = render(<TeamHours hours={undefined} loading error="" period="month" onPeriod={onPeriod} />);
    expect(screen.getByText("Loading time summary…")).toBeInTheDocument();
    rerender(<TeamHours hours={undefined} loading={false} error="" period="month" onPeriod={onPeriod} />);
    expect(screen.getByText("No time data is available.")).toBeInTheDocument();
    rerender(<TeamHours hours={undefined} loading={false} error="Permission denied" period="month" onPeriod={onPeriod} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Permission denied");
    rerender(<TeamHours hours={report} loading={false} error="" period="month" onPeriod={onPeriod} />);
    expect(screen.getByText(/2 days worked/)).toBeInTheDocument();
    expect(screen.getAllByText(/2026-08-10/)[0].parentElement).toHaveTextContent("7h 30m worked 1 open 1 incomplete 1 corrected");
    expect(screen.queryByText("private-id")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(onPeriod).toHaveBeenCalledWith("week");
  });
});

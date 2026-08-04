import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StatisticsFilterBar } from "./statistics-filter-bar";
import type { StatisticsFilters } from "../types/statistics";

const initialFilters: StatisticsFilters = {
  period: "year",
  from: "2026-01-01",
  to: "2026-12-31",
  metric: "GROSS",
  workTypeIds: [],
  calculationMethods: []
};

function FilterHarness() {
  const [filters, setFilters] = useState(initialFilters);
  return (
    <StatisticsFilterBar
      filters={filters}
      workTypes={[]}
      employments={[]}
      employmentIds={[]}
      onEmploymentsChange={() => undefined}
      onChange={setFilters}
    />
  );
}

describe("StatisticsFilterBar", () => {
  it("uses an iOS-style period selector without Today and reveals a custom range", () => {
    render(<FilterHarness />);

    expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Year" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Month")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Year")).toHaveValue("2026");

    fireEvent.click(screen.getByRole("button", { name: "Previous period" }));
    expect(screen.getByLabelText("Year")).toHaveValue("2025");

    fireEvent.click(screen.getByRole("button", { name: "Range" }));

    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Range" })).toHaveAttribute("aria-pressed", "true");
  });
});

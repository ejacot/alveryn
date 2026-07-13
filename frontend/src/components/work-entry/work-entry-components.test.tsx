import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkEntrySummaryCard } from "./work-entry-summary-card";
import { WorkTypePicker } from "./work-type-picker";
import { i18n } from "../../i18n";

describe("work-entry components", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders time-based summary labels and values", () => {
    render(
      <WorkEntrySummaryCard
        workTypeName="Regular Shift"
        workDate="2026-07-13"
        hourlyRate="20"
        currency="EUR"
        workedMinutes={480}
        grossAmount={160}
      />
    );

    expect(screen.getByText("Ready to save")).toBeInTheDocument();
    expect(screen.getByText("Worked hours")).toBeInTheDocument();
    expect(screen.getByText("Pay rate")).toBeInTheDocument();
    expect(screen.getByText("Work type")).toBeInTheDocument();
    expect(screen.getByText("Regular Shift")).toBeInTheDocument();
  });

  it("updates summary labels when the language changes", async () => {
    const { rerender } = render(
      <WorkEntrySummaryCard
        workTypeName="Orders"
        workDate="2026-07-13"
        hourlyRate="20"
        currency="EUR"
        workedMinutes={120}
        grossAmount={40}
      />
    );

    await act(async () => {
      await i18n.changeLanguage("ro");
    });
    rerender(
      <WorkEntrySummaryCard
        workTypeName="Orders"
        workDate="2026-07-13"
        hourlyRate="20"
        currency="EUR"
        workedMinutes={120}
        grossAmount={40}
      />
    );

    expect(screen.getByText("Rezumat")).toBeInTheDocument();
    expect(screen.getByText("Tarif")).toBeInTheDocument();
  });

  it("renders translated work-type labels and accessible selected state", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <WorkTypePicker
        selectedId="wt-time"
        onChange={onChange}
        workTypes={[
          {
            id: "wt-time",
            name: "Regular Shift",
            calculationMethod: "TIME_BASED",
            color: "#FFFFFF",
            icon: "R",
            defaultBreakMinutes: 30,
            displayOrder: 0,
            active: true
          },
          {
            id: "wt-unit",
            name: "Orders",
            calculationMethod: "UNIT_BASED",
            color: "#D4D4D8",
            icon: "O",
            defaultBreakMinutes: null,
            displayOrder: 1,
            active: false
          }
        ]}
      />
    );

    const activeButton = screen.getByRole("button", {
      name: "Regular Shift, Time based"
    });
    const inactiveButton = screen.getByRole("button", {
      name: "Orders, Unit based"
    });

    expect(activeButton).toHaveAttribute("aria-pressed", "true");
    expect(inactiveButton).toBeDisabled();

    await user.click(activeButton);
    expect(onChange).toHaveBeenCalledWith("wt-time");
  });

  it("switches work-type labels with the active language", async () => {
    const { rerender } = render(
      <WorkTypePicker
        selectedId="wt-time"
        onChange={() => undefined}
        workTypes={[
          {
            id: "wt-time",
            name: "Regular Shift",
            calculationMethod: "TIME_BASED",
            color: "#FFFFFF",
            icon: "R",
            defaultBreakMinutes: 30,
            displayOrder: 0,
            active: true
          }
        ]}
      />
    );

    await act(async () => {
      await i18n.changeLanguage("de");
    });
    rerender(
      <WorkTypePicker
        selectedId="wt-time"
        onChange={() => undefined}
        workTypes={[
          {
            id: "wt-time",
            name: "Regular Shift",
            calculationMethod: "TIME_BASED",
            color: "#FFFFFF",
            icon: "R",
            defaultBreakMinutes: 30,
            displayOrder: 0,
            active: true
          }
        ]}
      />
    );

    expect(screen.getByText("Zeitbasiert")).toBeInTheDocument();
  });
});

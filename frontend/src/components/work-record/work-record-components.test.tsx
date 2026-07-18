import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkTypePicker } from "./work-type-picker";
import { i18n } from "../../i18n";

describe("work-record components", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
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
      name: "Regular Shift, Time"
    });
    const inactiveButton = screen.getByRole("button", {
      name: "Orders, Units"
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

    expect(screen.getByText("Zeit")).toBeInTheDocument();
  });
});

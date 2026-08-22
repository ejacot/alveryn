import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, vi } from "vitest";
import { BusinessPlanningPrototypePage } from "./business-planning-prototype-page";

describe("BusinessPlanningPrototypePage B.1", () => {
  beforeEach(() => {
    Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
  });

  it("turns a typed demand value into a visible open schedule position", async () => {
    const user = userEvent.setup();
    render(<BusinessPlanningPrototypePage />);

    expect(screen.getByRole("heading", { name: "Turn hotel demand into open positions." })).toBeInTheDocument();
    const sundaySpa = screen.getAllByRole("textbox", { name: "Spa Spät on SUN" })[0];
    await user.clear(sundaySpa);
    await user.type(sundaySpa, "2");

    expect(screen.getByText("+1 open position")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Open schedule/ }));

    expect(screen.getByRole("heading", { name: "Build the week where the work lives." })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Open recommendation/ })).toBeInTheDocument();
    expect(screen.getByText("98 of 99 positions covered")).toBeInTheDocument();
  });

  it("previews and accepts a recommendation in the schedule before review and publish", async () => {
    const user = userEvent.setup();
    render(<BusinessPlanningPrototypePage />);

    const sundaySpa = screen.getAllByRole("textbox", { name: "Spa Spät on SUN" })[0];
    await user.clear(sundaySpa);
    await user.type(sundaySpa, "2");
    await user.click(screen.getByRole("button", { name: /Open schedule/ }));
    await user.click(screen.getByRole("gridcell", { name: /Open recommendation/ }));

    const inspector = screen.getByRole("complementary", { name: "Assignment recommendation" });
    await user.click(within(inspector).getByRole("button", { name: "Reject suggestion" }));
    expect(within(inspector).getByRole("status")).toHaveTextContent("The reason stays in the draft");
    await user.click(within(inspector).getByRole("button", { name: /Mara Klein/ }));
    expect(screen.getByRole("gridcell", { name: /Mara Klein Preview/ })).toBeInTheDocument();
    await user.click(within(inspector).getByRole("button", { name: "Assign manually" }));

    expect(screen.getByText("99 of 99 positions covered")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Review plan/ }));
    expect(screen.getByRole("heading", { name: "Is every requirement covered?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Simulate late hotel change" }));
    expect(screen.getByText("Saturday ROOM starts one hour earlier.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Publish v2/ }));
    await user.click(screen.getByRole("button", { name: /Print \/ share/ }));
    expect(screen.getByRole("dialog", { name: "Print preview" })).toBeInTheDocument();
    expect(screen.getByText("Dienstplan · KW 33 · 10–16 August 2026")).toBeInTheDocument();
  }, 10_000);
});

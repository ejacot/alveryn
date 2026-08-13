import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BusinessPlanningPrototypePage } from "./business-planning-prototype-page";

describe("BusinessPlanningPrototypePage", () => {
  it("keeps the KW33 prototype isolated and turns demand into positions", async () => {
    const user = userEvent.setup();
    render(<BusinessPlanningPrototypePage />);

    expect(screen.getByRole("heading", { name: "What does the hotel need this week?" })).toBeInTheDocument();
    expect(screen.getByText("98")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Increase Room cleaning on MON" }));
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("connects scheduling, recommendations, review, versions, and print", async () => {
    const user = userEvent.setup();
    render(<BusinessPlanningPrototypePage />);

    await user.click(screen.getByRole("button", { name: "Schedule" }));
    expect(screen.getByRole("heading", { name: "Build the week around the work." })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Recommendation" }));
    await user.click(screen.getByRole("button", { name: "Accept suggestion" }));
    expect(screen.getByText("Assigned to Sunday")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("heading", { name: "Is the week ready?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Versions" }));
    await user.click(screen.getByRole("button", { name: "Apply change to a new draft" }));
    expect(screen.getByText("5 PEOPLE AFFECTED")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish v2" }));
    await user.click(screen.getByRole("button", { name: "Open print preview" }));
    expect(screen.getByText("Dienstplan · KW 33 · 10–16 August 2026")).toBeInTheDocument();
  });
});

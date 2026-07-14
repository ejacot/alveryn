import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MainWorkspace } from "./main-workspace";

vi.mock("../../pages/dashboard-page", () => ({
  DashboardPage: () => <div>Home panel</div>
}));

vi.mock("../../pages/calendar-page", () => ({
  CalendarPage: () => <div>Calendar panel</div>
}));

vi.mock("../../pages/statistics-page", () => ({
  StatisticsPage: () => (
    <div>
      <button type="button">Chart point</button>
      Statistics panel
    </div>
  )
}));

vi.mock("../branding/app-logo", () => ({
  AppLogo: () => <div>Roomly</div>
}));

vi.mock("./week-selector", () => ({
  WeekSelector: () => <div>Week selector</div>
}));

function renderWorkspace(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MainWorkspace selectedDate={new Date("2026-07-15T12:00:00")} onSelectedDateChange={vi.fn()} visible />
    </MemoryRouter>
  );
}

describe("MainWorkspace", () => {
  it("mounts Home, Calendar and Statistics panels together", () => {
    renderWorkspace();

    expect(screen.getByText("Home panel")).toBeInTheDocument();
    expect(screen.getByText("Calendar panel")).toBeInTheDocument();
    expect(screen.getByText("Statistics panel")).toBeInTheDocument();
  });

  it("marks inactive panels as hidden for accessibility", () => {
    const { container } = renderWorkspace("/calendar");
    const panels = container.querySelectorAll(".workspace-panel");

    expect(panels[1]).toHaveAttribute("aria-hidden", "false");
    expect(panels[0]).toHaveAttribute("aria-hidden", "true");
    expect(panels[2]).toHaveAttribute("aria-hidden", "true");
  });

  it("does not complete navigation under the swipe threshold", () => {
    const { container } = renderWorkspace("/");
    const workspace = screen.getByTestId("main-workspace");

    fireEvent.pointerDown(workspace, { pointerId: 1, pointerType: "touch", clientX: 300, clientY: 300 });
    fireEvent.pointerMove(workspace, { pointerId: 1, pointerType: "touch", clientX: 240, clientY: 306 });
    fireEvent.pointerUp(workspace, { pointerId: 1, pointerType: "touch", clientX: 240, clientY: 306 });

    const panels = container.querySelectorAll(".workspace-panel");
    expect(panels[0]).toHaveAttribute("aria-hidden", "false");
  });

  it("ignores gestures that start on interactive controls", () => {
    const { container } = renderWorkspace("/statistics");
    const button = screen.getByRole("button", { name: "Chart point" });

    fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch", clientX: 240, clientY: 300 });
    fireEvent.pointerMove(button, { pointerId: 1, pointerType: "touch", clientX: 20, clientY: 306 });
    fireEvent.pointerUp(button, { pointerId: 1, pointerType: "touch", clientX: 20, clientY: 306 });

    const panels = container.querySelectorAll(".workspace-panel");
    expect(panels[2]).toHaveAttribute("aria-hidden", "false");
  });
});

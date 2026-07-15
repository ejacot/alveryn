import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  it("renders the active navigation items accessibly", () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Home")).toBeInTheDocument();
    expect(screen.getByLabelText("Calendar")).toBeInTheDocument();
    expect(screen.getByLabelText("Add entry")).toBeInTheDocument();
    expect(screen.getByLabelText("Statistics")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(5);

    const nav = container.querySelector("nav");
    expect(nav).toHaveClass("ios-glass-nav");
  });

  it("opens new activity with the selected date when provided", () => {
    render(
      <MemoryRouter>
        <BottomNav addEntryDate="2026-07-19" />
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Add entry")).toHaveAttribute(
      "href",
      "/entries/new?date=2026-07-19"
    );
  });
});

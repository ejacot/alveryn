import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  it("renders the five required navigation items accessibly", () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Home")).toBeInTheDocument();
    expect(screen.getByLabelText("Calendar")).toBeInTheDocument();
    expect(screen.getByLabelText("Add Entry")).toBeInTheDocument();
    expect(screen.getByLabelText("Statistics")).toBeInTheDocument();
    expect(screen.getByLabelText("Profile")).toBeInTheDocument();

    const nav = container.querySelector("nav");
    expect(nav).toHaveClass("ios-glass-nav");
  });
});

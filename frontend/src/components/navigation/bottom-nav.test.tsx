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

    expect(screen.getByLabelText("Today")).toBeInTheDocument();
    expect(screen.getByLabelText("Calendar")).toBeInTheDocument();
    expect(screen.getByLabelText("Insights")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(4);

    const nav = container.querySelector("nav");
    expect(nav).toHaveClass("ios-glass-nav");
  });

});

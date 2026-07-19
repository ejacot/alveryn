import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StatisticsPage } from "./statistics-page";

describe("StatisticsPage", () => {
  it("shows the unavailable state without loading statistics data", () => {
    render(
      <MemoryRouter>
        <StatisticsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Statistics" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clearer insights are on the way" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});

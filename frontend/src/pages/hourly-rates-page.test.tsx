import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HourlyRatesPage } from "./hourly-rates-page";

vi.mock("../api/endpoints", () => ({
  listHourlyRates: vi.fn(async () => [
    {
      id: "past",
      hourlyRate: "12.00",
      currency: "EUR",
      validFrom: "2026-01-01",
      validTo: "2026-06-30"
    },
    {
      id: "future",
      hourlyRate: "20.00",
      currency: "EUR",
      validFrom: "2026-08-01",
      validTo: null
    },
    {
      id: "current",
      hourlyRate: "17.50",
      currency: "EUR",
      validFrom: "2026-07-01",
      validTo: null
    }
  ])
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <HourlyRatesPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("HourlyRatesPage", () => {
  it("does not show explanatory copy under the title and sorts the current rate first", async () => {
    renderPage();

    expect(screen.queryByText(/rates are ordered/i)).not.toBeInTheDocument();

    await screen.findByText("17.50 EUR / hour");
    const rateCards = screen
      .getAllByRole("button")
      .filter((card) => card.textContent?.includes("EUR / hour"));
    const rateTexts = rateCards.map((card) => within(card).getByText(/EUR \/ hour/).textContent);

    expect(rateTexts).toEqual([
      "17.50 EUR / hour",
      "20.00 EUR / hour",
      "12.00 EUR / hour"
    ]);
  });
});

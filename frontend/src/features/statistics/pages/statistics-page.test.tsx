import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StatisticsPage } from "./statistics-page";

vi.mock("../../../api/endpoints", () => ({
  listWorkTypes: vi.fn(async () => []),
  listEmployments: vi.fn(async () => [])
}));

vi.mock("../hooks/use-statistics", () => ({
  useStatistics: vi.fn(() => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    overview: {
      data: {
        entries: 4,
        grossByCurrency: [{ currency: "EUR", amount: "640" }]
      }
    },
    timeSeries: {
      data: {
        metric: "GROSS",
        granularity: "DAILY",
        points: []
      }
    },
    workTypes: { data: [] },
    insights: { data: null, isLoading: false, isError: false, refetch: vi.fn() },
    forecast: { data: null, isLoading: false, isError: false, refetch: vi.fn() },
    productivity: { data: null, isLoading: false, isError: false, refetch: vi.fn() },
    highlights: { data: null, isLoading: false, isError: false, refetch: vi.fn() }
  }))
}));

vi.mock("../components/statistics-filter-bar", () => ({
  StatisticsFilterBar: ({ filters }: { filters: { period: string } }) => (
    <div>Statistics filters: {filters.period}</div>
  )
}));
vi.mock("../components/statistics-summary", () => ({
  StatisticsSummaryCards: () => <div>Summary cards</div>
}));
vi.mock("../charts/statistics-line-chart", () => ({
  StatisticsLineChart: () => <div>Trend chart</div>
}));
vi.mock("../components/statistics-drilldown-panel", () => ({
  StatisticsDrilldownPanel: () => null
}));
vi.mock("../components/statistics-comparison-panel", () => ({
  StatisticsComparisonPanel: () => <div>Period comparison</div>
}));
vi.mock("../components/work-type-breakdown", () => ({
  WorkTypeBreakdown: () => <div>Work type breakdown</div>
}));
vi.mock("../components/statistics-v2b-sections", () => ({
  StatisticsInsightsSection: () => <div>Insights</div>,
  StatisticsForecastSection: () => <div>Forecast</div>,
  StatisticsProductivitySection: () => <div>Productivity</div>,
  StatisticsHighlightsSection: () => <div>Highlights</div>
}));

describe("StatisticsPage", () => {
  it("renders the complete statistics workspace", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <MemoryRouter initialEntries={["/statistics"]}>
        <QueryClientProvider client={queryClient}>
          <StatisticsPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Statistics" })).toBeInTheDocument();
    expect(screen.getByText("Statistics filters: year")).toBeInTheDocument();
    expect(screen.queryByText("Primary summary")).not.toBeInTheDocument();
    expect(screen.getByText("Summary cards")).toBeInTheDocument();
    expect(screen.getByText("Trend chart")).toBeInTheDocument();
    expect(
      screen.getByText("Statistics filters: year").compareDocumentPosition(screen.getByText("Trend chart"))
        & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.getByText("Trend chart").compareDocumentPosition(screen.getByText("Summary cards"))
        & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByText("Forecast")).not.toBeInTheDocument();
    expect(screen.queryByText("Productivity")).not.toBeInTheDocument();
    expect(screen.queryByText("Activity heatmap")).not.toBeInTheDocument();
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("keeps a preset period when its explicit dates are present in the URL", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <MemoryRouter initialEntries={["/statistics?period=week&from=2026-08-03&to=2026-08-09"]}>
        <QueryClientProvider client={queryClient}>
          <StatisticsPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Statistics filters: week")).toBeInTheDocument();
  });
});

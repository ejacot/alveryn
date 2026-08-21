import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createBusinessOrganization } from "../api/endpoints";
import { WorkspaceProvider } from "../contexts/workspace-context";
import { BusinessPage } from "./business-page";

vi.mock("../api/endpoints", () => ({
  listOrganizations: vi.fn(async () => []),
  createBusinessOrganization: vi.fn(async (payload: { name: string; timezone: string }) => ({
    id: "organization-1", name: payload.name, timezone: payload.timezone,
    type: "BUSINESS", role: "OWNER"
  })),
  listOrganizationUnits: vi.fn(async () => []),
  createOrganizationUnit: vi.fn(),
  listOrganizationMembers: vi.fn(async () => []),
  createOrganizationMember: vi.fn()
}));

describe("BusinessPage", () => {
  it("creates a business workspace without changing the personal account", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <WorkspaceProvider>
            <BusinessPage />
          </WorkspaceProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Create your organization" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Organization name" }), "Hotel Berlin");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(createBusinessOrganization).toHaveBeenCalledWith(expect.objectContaining({ name: "Hotel Berlin" }));
  });
});

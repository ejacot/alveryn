import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { useSafeBackNavigation } from "./use-safe-back-navigation";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

function Harness() {
  const goBack = useSafeBackNavigation({ fallback: "/profile" });

  return (
    <button type="button" onClick={goBack}>
      Back
    </button>
  );
}

describe("useSafeBackNavigation", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("always uses the explicit app parent route", async () => {
    window.history.replaceState({ idx: 2 }, "", "/settings/profile");
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(navigateMock).toHaveBeenCalledWith("/profile", { replace: true });
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { InstallAppTip } from "./install-app-tip";

describe("InstallAppTip", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    });
  });

  it("shows in the browser and stays dismissed", () => {
    const { unmount } = render(<InstallAppTip />);

    expect(screen.getByText("Use Alveryn like an app")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss tip" }));
    expect(screen.queryByText("Use Alveryn like an app")).not.toBeInTheDocument();

    unmount();
    render(<InstallAppTip />);
    expect(screen.queryByText("Use Alveryn like an app")).not.toBeInTheDocument();
  });

  it("does not show in an installed PWA", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);

    render(<InstallAppTip />);

    expect(screen.queryByText("Use Alveryn like an app")).not.toBeInTheDocument();
  });
});

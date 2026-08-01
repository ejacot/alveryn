import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { RouteScrollReset } from "../components/navigation/route-scroll-reset";

export function AuthLayout() {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyPosition = document.body.style.position;
    const previousBodyWidth = document.body.style.width;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.position = previousBodyPosition;
      document.body.style.width = previousBodyWidth;
    };
  }, []);

  return (
    <div className="auth-shell fixed inset-0 overflow-hidden overscroll-none bg-[#0D0D0D] text-white">
      <RouteScrollReset />
      <Outlet />
    </div>
  );
}

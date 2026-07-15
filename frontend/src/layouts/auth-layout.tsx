import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PageTransition } from "../components/ui/page-transition";

export function AuthLayout() {
  const location = useLocation();

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
    <div className="fixed inset-0 overflow-hidden overscroll-none bg-black">
      <PageTransition routeKey={location.pathname}>
        <Outlet />
      </PageTransition>
    </div>
  );
}

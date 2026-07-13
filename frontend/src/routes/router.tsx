import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { PREVIEW_ROUTES_ENABLED } from "../api/config";
import { AppLayout } from "../layouts/app-layout";
import { AuthLayout } from "../layouts/auth-layout";
import { OnboardingLayout } from "../layouts/onboarding-layout";
import { RouteFallback } from "../components/ui/route-fallback";
import { GuestRoute } from "./guest-route";
import { ProtectedRoute } from "./protected-route";

const DashboardPage = lazy(() =>
  import("../pages/dashboard-page").then((module) => ({
    default: module.DashboardPage
  }))
);
const CalendarPage = lazy(() =>
  import("../pages/calendar-page").then((module) => ({
    default: module.CalendarPage
  }))
);
const WorkEntryEditorPage = lazy(() =>
  import("../pages/work-entry-editor-page").then((module) => ({
    default: module.WorkEntryEditorPage
  }))
);
const StatisticsPage = lazy(() =>
  import("../pages/statistics-page").then((module) => ({
    default: module.StatisticsPage
  }))
);
const ProfilePage = lazy(() =>
  import("../pages/profile-page").then((module) => ({
    default: module.ProfilePage
  }))
);
const SettingsDetailPage = lazy(() =>
  import("../pages/settings-detail-page").then((module) => ({
    default: module.SettingsDetailPage
  }))
);
const LoginPage = lazy(() =>
  import("../pages/login-page").then((module) => ({
    default: module.LoginPage
  }))
);
const RegisterPage = lazy(() =>
  import("../pages/register-page").then((module) => ({
    default: module.RegisterPage
  }))
);
const ForgotPasswordPage = lazy(() =>
  import("../pages/forgot-password-page").then((module) => ({
    default: module.ForgotPasswordPage
  }))
);
const ResetPasswordPage = lazy(() =>
  import("../pages/reset-password-page").then((module) => ({
    default: module.ResetPasswordPage
  }))
);
const VerifyEmailPage = lazy(() =>
  import("../pages/verify-email-page").then((module) => ({
    default: module.VerifyEmailPage
  }))
);
const PreviewDashboardPage = lazy(() =>
  import("../pages/preview-dashboard-page").then((module) => ({
    default: module.PreviewDashboardPage
  }))
);
const OnboardingPage = lazy(() =>
  import("../pages/onboarding-page").then((module) => ({
    default: module.OnboardingPage
  }))
);

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export function buildRoutes(enablePreviewRoutes = PREVIEW_ROUTES_ENABLED): RouteObject[] {
  const routes: RouteObject[] = [
    {
      element: <GuestRoute />,
      children: [
        {
          element: <AuthLayout />,
          children: [
            { path: "/login", element: withSuspense(<LoginPage />) },
            { path: "/register", element: withSuspense(<RegisterPage />) },
            {
              path: "/forgot-password",
              element: withSuspense(<ForgotPasswordPage />)
            },
            { path: "/reset-password", element: withSuspense(<ResetPasswordPage />) },
            { path: "/verify-email", element: withSuspense(<VerifyEmailPage />) }
          ]
        }
      ]
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { path: "/", element: withSuspense(<DashboardPage />) },
            { path: "/calendar", element: withSuspense(<CalendarPage />) },
            { path: "/entries/new", element: withSuspense(<WorkEntryEditorPage />) },
            { path: "/entries/:entryId", element: withSuspense(<WorkEntryEditorPage />) },
            { path: "/statistics", element: withSuspense(<StatisticsPage />) },
            { path: "/profile", element: withSuspense(<ProfilePage />) },
            { path: "/settings/profile", element: withSuspense(<SettingsDetailPage />) },
            { path: "/settings/security", element: withSuspense(<SettingsDetailPage />) },
            { path: "/settings/hourly-rates", element: withSuspense(<SettingsDetailPage />) },
            { path: "/settings/work-types", element: withSuspense(<SettingsDetailPage />) },
            {
              path: "/settings/preferences/language",
              element: withSuspense(<SettingsDetailPage />)
            },
            {
              path: "/settings/preferences/currency",
              element: withSuspense(<SettingsDetailPage />)
            },
            {
              path: "/settings/preferences/timezone",
              element: withSuspense(<SettingsDetailPage />)
            },
            {
              path: "/settings/preferences/appearance",
              element: withSuspense(<SettingsDetailPage />)
            },
            {
              path: "/settings/preferences/date-format",
              element: withSuspense(<SettingsDetailPage />)
            },
            {
              path: "/settings/preferences/time-format",
              element: withSuspense(<SettingsDetailPage />)
            },
            {
              path: "/settings/preferences/first-day-of-week",
              element: withSuspense(<SettingsDetailPage />)
            },
            { path: "/settings/export-data", element: withSuspense(<SettingsDetailPage />) },
            { path: "/settings/notifications", element: withSuspense(<SettingsDetailPage />) },
            { path: "/settings/about", element: withSuspense(<SettingsDetailPage />) },
            { path: "/settings/help", element: withSuspense(<SettingsDetailPage />) }
          ]
        },
        {
          element: <OnboardingLayout />,
          children: [{ path: "/onboarding", element: withSuspense(<OnboardingPage />) }]
        }
      ]
    }
  ];

  if (enablePreviewRoutes) {
    routes.splice(1, 0, {
      path: "/preview/dashboard",
      element: <AppLayout />,
      children: [{ index: true, element: withSuspense(<PreviewDashboardPage />) }]
    });
  }

  return routes;
}

export function createAppRouter() {
  return createBrowserRouter(buildRoutes());
}

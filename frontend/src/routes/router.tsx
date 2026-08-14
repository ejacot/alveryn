import { Suspense, lazy, type ReactNode } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { PREVIEW_ROUTES_ENABLED } from "../api/config";
import { AppLayout } from "../layouts/app-layout";
import { AuthLayout } from "../layouts/auth-layout";
import { OnboardingLayout } from "../layouts/onboarding-layout";
import { RouteFallback } from "../components/ui/route-fallback";
import { GuestRoute } from "./guest-route";
import { ProtectedRoute } from "./protected-route";
import { RouteErrorPage } from "../components/ui/route-error-page";
import { ProfilePage } from "../pages/profile-page";
import { APP_HOME_PATH } from "./app-paths";

const WorkRecordEditorPage = lazy(() =>
  import("../pages/work-record-editor-page").then((module) => ({
    default: module.WorkRecordEditorPage
  }))
);
const HomePage = lazy(() =>
  import("../pages/home-page").then((module) => ({
    default: module.HomePage
  }))
);
const WelcomePage = lazy(() =>
  import("../pages/welcome-page").then((module) => ({
    default: module.WelcomePage
  }))
);
const WelcomeProductPage = lazy(() =>
  import("../pages/welcome-product-page").then((module) => ({ default: module.WelcomeProductPage }))
);
const CalendarPage = lazy(() =>
  import("../pages/calendar-page").then((module) => ({
    default: module.CalendarPage
  }))
);
const StatisticsPage = lazy(() =>
  import("../pages/statistics-page").then((module) => ({
    default: module.StatisticsPage
  }))
);
const SettingsProfilePage = lazy(() =>
  import("../pages/settings-profile-page").then((module) => ({
    default: module.SettingsProfilePage
  }))
);
const SettingsPreferencesPage = lazy(() =>
  import("../pages/settings-preferences-page").then((module) => ({
    default: module.SettingsPreferencesPage
  }))
);
const SettingsAbsencePage = lazy(() =>
  import("../pages/settings-absence-page").then((module) => ({
    default: module.SettingsAbsencePage
  }))
);
const SettingsEmploymentPage = lazy(() =>
  import("../pages/settings-employment-page").then((module) => ({
    default: module.SettingsEmploymentPage
  }))
);
const SettingsEmploymentDetailPage = lazy(() =>
  import("../pages/settings-employment-detail-page").then((module) => ({
    default: module.SettingsEmploymentDetailPage
  }))
);
const SettingsCheckInTimerPage = lazy(() =>
  import("../pages/settings-check-in-timer-page").then((module) => ({
    default: module.SettingsCheckInTimerPage
  }))
);
const SettingsHoursBalancePage = lazy(() =>
  import("../pages/settings-hours-balance-page").then((module) => ({
    default: module.SettingsHoursBalancePage
  }))
);
const SettingsSchedulePage = lazy(() =>
  import("../pages/settings-schedule-page").then((module) => ({
    default: module.SettingsSchedulePage
  }))
);
const SettingsEmploymentExtraPayPage = lazy(() =>
  import("../pages/settings-employment-extra-pay-page").then((module) => ({
    default: module.SettingsEmploymentExtraPayPage
  }))
);
const HourlyRatesPage = lazy(() =>
  import("../pages/hourly-rates-page").then((module) => ({
    default: module.HourlyRatesPage
  }))
);
const HourlyRateEditorPage = lazy(() =>
  import("../pages/hourly-rate-editor-page").then((module) => ({
    default: module.HourlyRateEditorPage
  }))
);
const WorkTypesPage = lazy(() =>
  import("../pages/work-types-page").then((module) => ({
    default: module.WorkTypesPage
  }))
);
const WorkTypeEditorPage = lazy(() =>
  import("../pages/work-type-editor-page").then((module) => ({
    default: module.WorkTypeEditorPage
  }))
);
const AboutAlverynPage = lazy(() =>
  import("../pages/about-alveryn-page").then((module) => ({
    default: module.AboutAlverynPage
  }))
);
const HelpSupportPage = lazy(() =>
  import("../pages/help-support-page").then((module) => ({
    default: module.HelpSupportPage
  }))
);
const PdfExportPage = lazy(() =>
  import("../pages/pdf-export-page").then((module) => ({
    default: module.PdfExportPage
  }))
);
const DataImportPage = lazy(() =>
  import("../pages/data-import-page").then((module) => ({
    default: module.DataImportPage
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
const OAuthCallbackPage = lazy(() =>
  import("../pages/oauth-callback-page").then((module) => ({
    default: module.OAuthCallbackPage
  }))
);
const PreviewDashboardPage = lazy(() =>
  import("../pages/preview-dashboard-page").then((module) => ({
    default: module.PreviewDashboardPage
  }))
);
const BusinessPlanningPrototypePage = lazy(() =>
  import("../pages/business-planning-prototype-page").then((module) => ({
    default: module.BusinessPlanningPrototypePage
  }))
);
const OnboardingPage = lazy(() =>
  import("../pages/onboarding-page").then((module) => ({
    default: module.OnboardingPage
  }))
);
const TrackingSetupPage = lazy(() =>
  import("../pages/tracking-setup-page").then((module) => ({
    default: module.TrackingSetupPage
  }))
);
const BusinessPage = lazy(() =>
  import("../pages/business-page").then((module) => ({ default: module.BusinessPage }))
);
const BusinessDemandPage = lazy(() =>
  import("../pages/business-demand-page").then((module) => ({ default: module.BusinessDemandPage }))
);
const BusinessSchedulePage = lazy(() =>
  import("../pages/business-schedule-page").then((module) => ({ default: module.BusinessSchedulePage }))
);
const BusinessReviewPage = lazy(() =>
  import("../pages/business-review-page").then((module) => ({ default: module.BusinessReviewPage }))
);
const BusinessWorkTypesPage=lazy(()=>import("../pages/business-work-types-page").then(module=>({default:module.BusinessWorkTypesPage})));
const BusinessWorkTypeEditorPage=lazy(()=>import("../pages/business-work-type-editor-page").then(module=>({default:module.BusinessWorkTypeEditorPage})));
const SchedulePage = lazy(() => import("../pages/schedule-page").then((module) => ({ default: module.SchedulePage })));
function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export function buildRoutes(enablePreviewRoutes = PREVIEW_ROUTES_ENABLED): RouteObject[] {
  const routes: RouteObject[] = [
    {
      path: "/",
      element: withSuspense(<WelcomePage />),
      errorElement: <RouteErrorPage />
    },
    {
      path: "/welcome",
      element: withSuspense(<WelcomePage />),
      errorElement: <RouteErrorPage />
    },
    ...(["dashboard", "calendar", "statistics"] as const).map((product) => ({
      path: `/welcome/${product}`,
      element: withSuspense(<WelcomeProductPage product={product} />),
      errorElement: <RouteErrorPage />
    })),
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorPage />,
      children: [
        { path: "/auth/oauth/callback", element: withSuspense(<OAuthCallbackPage />) },
        { path: "/verify-email", element: withSuspense(<VerifyEmailPage />) }
      ]
    },
    {
      element: <GuestRoute />,
      errorElement: <RouteErrorPage />,
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
            { path: "/reset-password", element: withSuspense(<ResetPasswordPage />) }
          ]
        }
      ]
    },
    {
      element: <ProtectedRoute />,
      errorElement: <RouteErrorPage />,
      children: [
        {
          element: <AppLayout />,
          children: [
            { path: APP_HOME_PATH, element: withSuspense(<HomePage />) },
            { path: "/calendar", element: withSuspense(<CalendarPage />) },
            { path: "/records/new", element: withSuspense(<WorkRecordEditorPage />) },
            { path: "/records/:recordId", element: withSuspense(<WorkRecordEditorPage />) },
            { path: "/statistics", element: withSuspense(<StatisticsPage />) },
            { path: "/business", element: withSuspense(<BusinessPage />) },
            { path: "/business/:organizationId/plan/demand", element: withSuspense(<BusinessDemandPage />) },
            { path: "/business/:organizationId/plan/schedule", element: withSuspense(<BusinessSchedulePage />) },
            { path: "/business/:organizationId/plan/review", element: withSuspense(<BusinessReviewPage />) },
            { path: "/business/:organizationId/work-types", element: withSuspense(<BusinessWorkTypesPage />) },
            { path: "/business/:organizationId/work-types/new", element: withSuspense(<BusinessWorkTypeEditorPage />) },
            { path: "/business/:organizationId/work-types/:workTypeId", element: withSuspense(<BusinessWorkTypeEditorPage />) },
            { path: "/schedule", element: withSuspense(<SchedulePage />) },
            { path: "/profile", element: withSuspense(<ProfilePage />) },
            { path: "/settings/profile", element: withSuspense(<SettingsProfilePage />) },
            { path: "/settings/preferences", element: withSuspense(<SettingsPreferencesPage />) },
            { path: "/settings/absences", element: withSuspense(<SettingsAbsencePage />) },
            { path: "/settings/employment", element: withSuspense(<SettingsEmploymentPage />) },
            { path: "/settings/employment/:employmentId", element: withSuspense(<SettingsEmploymentDetailPage />) },
            { path: "/settings/employment/:employmentId/check-in-timer", element: withSuspense(<SettingsCheckInTimerPage />) },
            { path: "/settings/employment/:employmentId/hours-balance", element: withSuspense(<SettingsHoursBalancePage />) },
            { path: "/settings/employment/:employmentId/schedule", element: withSuspense(<SettingsSchedulePage />) },
            { path: "/settings/employment/:employmentId/extra-pay", element: withSuspense(<SettingsEmploymentExtraPayPage />) },
            { path: "/settings/hourly-rates", element: withSuspense(<HourlyRatesPage />) },
            { path: "/settings/hourly-rates/new", element: withSuspense(<HourlyRateEditorPage />) },
            { path: "/settings/hourly-rates/:rateId", element: withSuspense(<HourlyRateEditorPage />) },
            { path: "/settings/work-types", element: withSuspense(<WorkTypesPage />) },
            { path: "/settings/work-types/new", element: withSuspense(<WorkTypeEditorPage />) },
            { path: "/settings/work-types/:workTypeId", element: withSuspense(<WorkTypeEditorPage />) },
            { path: "/settings/about", element: withSuspense(<AboutAlverynPage />) },
            { path: "/settings/help", element: withSuspense(<HelpSupportPage />) },
            { path: "/settings/export-pdf", element: withSuspense(<PdfExportPage />) },
            { path: "/settings/import-data", element: withSuspense(<DataImportPage />) }
          ]
        },
        {
          element: <OnboardingLayout />,
          children: [
            { path: "/tracking-setup", element: withSuspense(<TrackingSetupPage />) },
            { path: "/onboarding", element: withSuspense(<OnboardingPage />) }
          ]
        }
      ]
    }
  ];

  if (enablePreviewRoutes) {
    routes.splice(
      1,
      0,
      {
        path: "/preview/dashboard",
        element: <AppLayout />,
        errorElement: <RouteErrorPage />,
        children: [{ index: true, element: withSuspense(<PreviewDashboardPage />) }]
      },
      {
        path: "/preview/business-planning",
        element: withSuspense(<BusinessPlanningPrototypePage />),
        errorElement: <RouteErrorPage />
      }
    );
  }

  routes.push({
    path: "*",
    element: (
      <RouteErrorPage
        title="Page not found"
        description="This screen is not available or the link has changed."
      />
    )
  });

  return routes;
}

export function createAppRouter() {
  return createBrowserRouter(buildRoutes());
}

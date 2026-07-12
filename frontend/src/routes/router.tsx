import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layouts/app-layout";
import { AuthLayout } from "../layouts/auth-layout";
import { GuestRoute } from "./guest-route";
import { ProtectedRoute } from "./protected-route";
import { DashboardPage } from "../pages/dashboard-page";
import { LoginPage } from "../pages/login-page";
import { RegisterPage } from "../pages/register-page";
import { ForgotPasswordPage } from "../pages/forgot-password-page";
import { ResetPasswordPage } from "../pages/reset-password-page";
import { VerifyEmailPage } from "../pages/verify-email-page";
import { CalendarPage } from "../pages/calendar-page";
import { AddEntryPage } from "../pages/add-entry-page";
import { StatisticsPage } from "../pages/statistics-page";
import { ProfilePage } from "../pages/profile-page";

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
          { path: "/forgot-password", element: <ForgotPasswordPage /> },
          { path: "/reset-password", element: <ResetPasswordPage /> },
          { path: "/verify-email", element: <VerifyEmailPage /> }
        ]
      }
    ]
  },
  {
    path: "/preview/dashboard",
    element: <AppLayout />,
    children: [{ index: true, element: <DashboardPage /> }]
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/calendar", element: <CalendarPage /> },
          { path: "/entries/new", element: <AddEntryPage /> },
          { path: "/statistics", element: <StatisticsPage /> },
          { path: "/profile", element: <ProfilePage /> }
        ]
      }
    ]
  }
]);

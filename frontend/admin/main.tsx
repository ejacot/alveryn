import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/sora/500.css";
import "@fontsource/sora/600.css";
import "../src/styles/index.css";
import "../src/i18n";

import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "../src/api/query-client";
import { AuthProvider } from "../src/features/auth/auth-provider";
import { createAdminRouter } from "../src/admin/admin-router";
import { applyAppTheme } from "../src/utils/theme";

applyAppTheme("DARK");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={createAdminRouter()} />
        </AuthProvider>
      </QueryClientProvider>
    </MotionConfig>
  </React.StrictMode>
);

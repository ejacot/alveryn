import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_DEV_PROXY_TARGET || "http://localhost:8080",
          changeOrigin: true
        },
        "/actuator": {
          target: env.VITE_DEV_PROXY_TARGET || "http://localhost:8080",
          changeOrigin: true
        }
      }
    },
    preview: {
      host: "0.0.0.0",
      port: 4173
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react-router/") ||
              id.includes("/react-router-dom/")
            ) {
              return "react-vendor";
            }

            if (
              id.includes("/react-hook-form/") ||
              id.includes("/zod/") ||
              id.includes("/@hookform/")
            ) {
              return "form-vendor";
            }

            if (
              id.includes("/axios/") ||
              id.includes("/@tanstack/")
            ) {
              return "data-vendor";
            }

            if (
              id.includes("/framer-motion/") ||
              id.includes("/motion-dom/") ||
              id.includes("/motion-utils/") ||
              id.includes("/lucide-react/")
            ) {
              return "ui-vendor";
            }

            return "vendor";
          }
        }
      }
    }
  };
});

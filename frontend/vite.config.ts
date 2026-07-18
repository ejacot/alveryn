import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

function localApiProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq) => {
        proxyReq.removeHeader("origin");
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": localApiProxy(env.VITE_DEV_PROXY_TARGET || "http://localhost:8080"),
        "/actuator": localApiProxy(env.VITE_DEV_PROXY_TARGET || "http://localhost:8080")
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
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }

            if (
              id.includes("/@tanstack/") ||
              id.includes("/axios/") ||
              id.includes("/react-router-dom/") ||
              id.includes("/@remix-run/")
            ) {
              return "vendor-app";
            }

            if (
              id.includes("/i18next/") ||
              id.includes("/react-i18next/") ||
              id.includes("/@fontsource/")
            ) {
              return "vendor-i18n";
            }

            if (id.includes("/framer-motion/") || id.includes("/motion-dom/")) {
              return "vendor-motion";
            }

            if (id.includes("/zod/")) {
              return "vendor-validation";
            }

            return "vendor";
          }
        }
      }
    }
  };
});

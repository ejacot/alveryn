import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import { vendorChunkName } from "./vite.vendor-chunks";

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
          manualChunks: vendorChunkName
        }
      }
    }
  };
});

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import { resolve } from "node:path";

function localApiProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    root: resolve(process.cwd(), "admin"),
    envDir: process.cwd(),
    publicDir: false,
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5174,
      proxy: {
        "/api": localApiProxy(env.VITE_DEV_PROXY_TARGET || "http://localhost:8080"),
        "/actuator": localApiProxy(env.VITE_DEV_PROXY_TARGET || "http://localhost:8080")
      }
    },
    build: {
      outDir: resolve(process.cwd(), "dist-admin"),
      emptyOutDir: true
    }
  };
});

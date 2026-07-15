import type { FullConfig } from "@playwright/test";

async function waitFor(url: string) {
  const timeoutMs = Number(process.env.ALVERYN_E2E_STARTUP_TIMEOUT_MS ?? 120_000);
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL?.toString() ?? "http://127.0.0.1:5173";
  const apiURL = process.env.ALVERYN_E2E_API_URL ?? "http://127.0.0.1:8080";

  await waitFor(baseURL);
  await waitFor(`${apiURL}/actuator/health`);
}

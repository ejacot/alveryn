import { execFileSync } from "node:child_process";
import { request, type Page } from "@playwright/test";

const apiURL = process.env.ROOMLY_E2E_API_URL ?? "http://127.0.0.1:8080";
const dbName = process.env.E2E_DB_NAME ?? "roomly";
const dbUser = process.env.E2E_DB_USER ?? "roomly";
const dbPassword = process.env.E2E_DB_PASSWORD ?? "change-me";
const dbHost = process.env.E2E_DB_HOST ?? "127.0.0.1";
const dbPort = process.env.E2E_DB_PORT ?? "5432";
const dbContainer = process.env.E2E_DB_CONTAINER ?? "roomly-postgres";

export type E2eUser = {
  email: string;
  password: string;
  accessToken: string;
};

export async function createE2eUser(testName: string): Promise<E2eUser> {
  const safeName = testName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  const email = `roomly.e2e.${safeName}.${Date.now()}@example.com`;
  const emailSql = email.replace(/'/g, "''");
  const password = `Password-${Date.now()}!`;
  const api = await request.newContext({ baseURL: apiURL });

  await api.post("/api/auth/register", {
    data: { email, password }
  });

  const psqlArgs = [
    "-h",
    dbHost,
    "-p",
    dbPort,
    "-U",
    dbUser,
    "-d",
    dbName,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `update user_accounts set email_verified = true, security_code_hash = null, security_code_expires_at = null where email = '${emailSql}'`,
    "-c",
    `update user_preferences set onboarding_completed = true, language = 'en', currency = 'EUR', timezone = 'Europe/Berlin' where user_id = (select id from user_accounts where email = '${emailSql}')`
  ];
  const psqlCommand = process.env.E2E_PSQL_BIN ?? "psql";

  try {
    execFileSync(psqlCommand, psqlArgs, {
      env: { ...process.env, PGPASSWORD: dbPassword },
      stdio: "pipe"
    });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    execFileSync("docker", ["exec", "-e", `PGPASSWORD=${dbPassword}`, dbContainer, "psql", ...psqlArgs], {
      stdio: "pipe"
    });
  }

  const login = await api.post("/api/auth/login", {
    data: { email, password }
  });
  const body = await login.json();
  await api.dispose();

  return { email, password, accessToken: body.data.accessToken };
}

export async function loginThroughUi(page: Page, user: E2eUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("/");
}

export async function createHourlyRate(accessToken: string) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  await api.post("/api/hourly-rates", {
    data: {
      hourlyRate: 20,
      currency: "EUR",
      validFrom: "2026-01-01",
      validTo: null
    }
  });
  await api.dispose();
}

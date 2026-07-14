import { execFileSync } from "node:child_process";
import { request, type APIResponse, type Page } from "@playwright/test";

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

async function readResponseBody(response: APIResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}

async function requireSuccessfulResponse<T extends { data?: unknown }>(
  response: APIResponse,
  action: string
): Promise<T> {
  const body = (await readResponseBody(response)) as T;

  if (!response.ok()) {
    throw new Error(`${action} failed with HTTP ${response.status()}: ${JSON.stringify(body)}`);
  }

  return body;
}

export async function createE2eUser(testName: string): Promise<E2eUser> {
  const safeName = testName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  const email = `roomly.e2e.${safeName}.${Date.now()}@example.com`;
  const emailSql = email.replace(/'/g, "''");
  const password = `Password-${Date.now()}!`;
  const api = await request.newContext({ baseURL: apiURL });

  const register = await api.post("/api/auth/register", {
    data: { email, password }
  });
  await requireSuccessfulResponse(register, "Register e2e user");

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
  const body = await requireSuccessfulResponse<{ data?: { accessToken?: string } }>(login, "Login e2e user");
  await api.dispose();

  if (!body.data?.accessToken) {
    throw new Error(`Login e2e user did not return an access token: ${JSON.stringify(body)}`);
  }

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

export async function createTimeBasedWorkType(accessToken: string, name: string) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/work-types", {
    data: { name, calculationMethod: "TIME_BASED" }
  });
  const body = await requireSuccessfulResponse<{ data?: { id?: string } }>(response, "Create work type");
  await api.dispose();

  if (!body.data?.id) {
    throw new Error(`Create work type did not return an id: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

export async function createTimeEntry(accessToken: string, workTypeId: string) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/work-entries", {
    data: {
      workTypeId,
      workDate: "2026-07-14",
      startTime: "09:00:00",
      endTime: "17:00:00",
      unpaidBreakMinutes: 0
    }
  });
  await requireSuccessfulResponse(response, "Create time entry");
  await api.dispose();
}

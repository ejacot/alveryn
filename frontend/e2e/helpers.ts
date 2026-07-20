import { execFileSync } from "node:child_process";
import { request, type APIResponse, type Page } from "@playwright/test";

const apiURL = process.env.ALVERYN_E2E_API_URL ?? "http://127.0.0.1:8080";
const dbName = process.env.E2E_DB_NAME ?? "alveryn";
const dbUser = process.env.E2E_DB_USER ?? "alveryn";
const dbPassword = process.env.E2E_DB_PASSWORD ?? "change-me";
const dbHost = process.env.E2E_DB_HOST ?? "127.0.0.1";
const dbPort = process.env.E2E_DB_PORT ?? "5432";
const dbContainer = process.env.E2E_DB_CONTAINER ?? "alveryn-postgres";

export type E2eUser = {
  email: string;
  password: string;
  accessToken: string;
  employmentId: string;
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
  const email = `alveryn.e2e.${safeName}.${Date.now()}@example.com`;
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
    `update user_preferences set onboarding_completed = true, tracking_setup_version_completed = 1, language = 'en', currency = 'EUR', timezone = 'Europe/Berlin' where user_id = (select id from user_accounts where email = '${emailSql}')`
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

  if (!body.data?.accessToken) {
    await api.dispose();
    throw new Error(`Login e2e user did not return an access token: ${JSON.stringify(body)}`);
  }
  const employment = await api.post("/api/employments", {
    headers: { Authorization: `Bearer ${body.data.accessToken}` },
    data: {
      name: "Primary employment",
      trackingFocus: "EARNINGS",
      hourBalanceEnabled: false,
      termsValidFrom: "2026-01-01",
      startDate: "2026-01-01",
      endDate: null,
      active: true,
      displayOrder: 0
    }
  });
  const employmentBody = await requireSuccessfulResponse<{ data?: { id?: string } }>(employment, "Create e2e employment");
  await api.dispose();
  if (!employmentBody.data?.id) {
    throw new Error(`Create e2e employment did not return an id: ${JSON.stringify(employmentBody)}`);
  }

  return { email, password, accessToken: body.data.accessToken, employmentId: employmentBody.data.id };
}

export async function loginThroughUi(page: Page, user: E2eUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/app$/);
}

export async function createHourlyRate(accessToken: string, employmentId: string) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/hourly-rates", {
    data: {
      hourlyRate: 20,
      employmentId,
      currency: "EUR",
      validFrom: "2026-01-01",
      validTo: null
    }
  });
  await requireSuccessfulResponse(response, "Create hourly rate");
  await api.dispose();
}

export async function createTimeBasedWorkType(accessToken: string, employmentId: string, name: string) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/work-types", {
    data: { name, employmentId, calculationMethod: "TIME_BASED" }
  });
  const body = await requireSuccessfulResponse<{ data?: { id?: string } }>(response, "Create work type");
  await api.dispose();

  if (!body.data?.id) {
    throw new Error(`Create work type did not return an id: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

export async function createUnitBasedWorkType(accessToken: string, employmentId: string, name: string) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/work-types", {
    data: {
      name,
      employmentId,
      calculationMethod: "UNIT_BASED",
      compensationMethod: "PER_UNIT",
      compositeEnabled: true
    }
  });
  const body = await requireSuccessfulResponse<{ data?: { id?: string } }>(response, "Create unit work type");
  await api.dispose();

  if (!body.data?.id) {
    throw new Error(`Create unit work type did not return an id: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

export async function createPerUnitWorkType(accessToken: string, employmentId: string, name: string) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/work-types", {
    data: {
      name,
      employmentId,
      calculationMethod: "UNIT_BASED",
      compensationMethod: "PER_UNIT",
      compositeEnabled: true,
      teamworkEnabled: true
    }
  });
  const body = await requireSuccessfulResponse<{ data?: { id?: string } }>(response, "Create per-unit work type");
  await api.dispose();

  if (!body.data?.id) {
    throw new Error(`Create per-unit work type did not return an id: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

export async function createPerUnitWorkTypeChild(
  accessToken: string,
  parentId: string,
  name: string,
  payload: {
    unitLabel: string;
    unitSymbol?: string;
    ratePerUnit: number;
    currency: string;
  }
) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/work-types", {
    data: {
      parentId,
      name,
      calculationMethod: "UNIT_BASED",
      compensationMethod: "PER_UNIT",
      unitLabel: payload.unitLabel,
      unitSymbol: payload.unitSymbol ?? null,
      ratePerUnit: payload.ratePerUnit,
      currency: payload.currency,
      teamworkEnabled: true,
      defaultBreakMinutes: null
    }
  });
  const body = await requireSuccessfulResponse<{ data?: { id?: string } }>(
    response,
    "Create per-unit work type child"
  );
  await api.dispose();

  if (!body.data?.id) {
    throw new Error(`Create per-unit work type child did not return an id: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

export async function createUnitsPerHourWorkTypeChild(
  accessToken: string,
  parentId: string,
  name: string,
  payload: {
    unitLabel: string;
    unitSymbol?: string;
    unitsPerHour: number;
  }
) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/work-types", {
    data: {
      parentId,
      name,
      calculationMethod: "UNITS_PER_HOUR_BASED",
      compensationMethod: "HOURLY",
      unitLabel: payload.unitLabel,
      unitSymbol: payload.unitSymbol ?? null,
      unitsPerHour: payload.unitsPerHour,
      ratePerUnit: null,
      currency: null,
      defaultBreakMinutes: null,
      active: true
    }
  });
  const body = await requireSuccessfulResponse<{ data?: { id?: string } }>(
    response,
    "Create units-per-hour work type child"
  );
  await api.dispose();

  if (!body.data?.id) {
    throw new Error(`Create units-per-hour work type child did not return an id: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

export async function createTimeHourlyWorkTypeChild(
  accessToken: string,
  parentId: string,
  name = "Hours"
) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/work-types", {
    data: {
      parentId,
      name,
      calculationMethod: "TIME_BASED",
      defaultBreakMinutes: 0
    }
  });
  const body = await requireSuccessfulResponse<{ data?: { id?: string } }>(
    response,
    "Create time-hourly work type child"
  );
  await api.dispose();

  if (!body.data?.id) {
    throw new Error(`Create time-hourly work type child did not return an id: ${JSON.stringify(body)}`);
  }
  return body.data.id;
}

export async function createTimeEntry(
  accessToken: string,
  workTypeId: string,
  workDate = "2026-07-14",
  startTime = "09:00:00",
  endTime = "17:00:00"
) {
  await createWorkRecordWithLine(accessToken, workTypeId, workDate, {
    startTime,
    endTime,
    unpaidBreakMinutes: 0
  });
}

export async function createWorkRecordWithLine(
  accessToken: string,
  workTypeId: string,
  workDate = "2026-07-04",
  payload:
    | { quantity: number }
    | { startTime: string; endTime: string; unpaidBreakMinutes?: number; extraPayPercentage?: number } = { quantity: 4 }
) {
  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` }
  });
  const response = await api.post("/api/work-records", {
    data: {
      workDate,
      lines: [
        {
          workTypeId,
          quantity: "quantity" in payload ? payload.quantity : null,
          startTime: "startTime" in payload ? payload.startTime : null,
          endTime: "endTime" in payload ? payload.endTime : null,
          unpaidBreakMinutes: "unpaidBreakMinutes" in payload ? payload.unpaidBreakMinutes ?? 0 : null,
          extraPayPercentage: "extraPayPercentage" in payload ? payload.extraPayPercentage ?? 0 : 0
        }
      ]
    }
  });
  await requireSuccessfulResponse(response, "Create work record");
  await api.dispose();
}

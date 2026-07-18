import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, request } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const outputDir = resolve(repoRoot, "frontend/src/assets/landing");

const baseURL = process.env.ALVERYN_E2E_BASE_URL ?? "http://127.0.0.1:5173";
const apiURL = process.env.ALVERYN_E2E_API_URL ?? "http://127.0.0.1:8080";
const dbName = process.env.E2E_DB_NAME ?? process.env.POSTGRES_DB ?? "alveryn";
const dbUser = process.env.E2E_DB_USER ?? process.env.POSTGRES_USER ?? "alveryn";
const dbPassword = process.env.E2E_DB_PASSWORD ?? process.env.POSTGRES_PASSWORD ?? "change-me";
const dbHost = process.env.E2E_DB_HOST ?? "127.0.0.1";
const dbPort = process.env.E2E_DB_PORT ?? "5432";
const dbContainer = process.env.E2E_DB_CONTAINER ?? "alveryn-postgres";

const email = "alveryn.landing.demo@example.com";
const password = "Landing-Demo-2026!";
const screenshotDate = "2026-07-16";

function runSql(sql) {
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
    sql
  ];
  const env = { ...process.env, PGPASSWORD: dbPassword };

  try {
    execFileSync(process.env.E2E_PSQL_BIN ?? "psql", psqlArgs, { env, stdio: "pipe" });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    execFileSync("docker", ["exec", "-e", `PGPASSWORD=${dbPassword}`, dbContainer, "psql", ...psqlArgs], {
      stdio: "pipe"
    });
  }
}

async function requireOk(response, action) {
  const body = await response.json().catch(async () => response.text());
  if (!response.ok()) {
    throw new Error(`${action} failed with HTTP ${response.status()}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function apiPost(api, path, data, action) {
  const response = await api.post(path, { data });
  const body = await requireOk(response, action);
  return body.data;
}

async function waitFor(url) {
  const deadline = Date.now() + 120_000;
  let lastError;
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
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function iso(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isAbsenceDate(date) {
  return [
    "2026-05-01",
    "2026-05-21",
    "2026-06-12",
    "2026-06-29",
    "2026-06-30",
    "2026-07-07"
  ].includes(date);
}

async function seedDemoData() {
  await waitFor(`${apiURL}/actuator/health`);
  await waitFor(baseURL);

  runSql(`delete from user_accounts where email = '${email}'`);

  const anonApi = await request.newContext({ baseURL: apiURL });
  await apiPost(anonApi, "/api/auth/register", { email, password }, "Register landing demo user");
  runSql(`
    update user_accounts
       set email_verified = true,
           security_code_hash = null,
           security_code_expires_at = null
     where email = '${email}';
    update user_preferences
       set onboarding_completed = true,
           language = 'en',
           currency = 'EUR',
           timezone = 'Europe/Berlin',
           first_day_of_week = 'MONDAY',
           theme = 'DARK',
           preferred_daily_minutes = 480,
           default_break_minutes = 30,
           paid_sick_leave = true,
           paid_vacation = true
     where user_id = (select id from user_accounts where email = '${email}');
  `);

  const auth = await apiPost(anonApi, "/api/auth/login", { email, password }, "Login landing demo user");
  await anonApi.dispose();

  const api = await request.newContext({
    baseURL: apiURL,
    extraHTTPHeaders: { Authorization: `Bearer ${auth.accessToken}` }
  });

  await apiPost(api, "/api/hourly-rates", {
    hourlyRate: 17.5,
    currency: "EUR",
    validFrom: "2026-04-01",
    validTo: "2026-05-31"
  }, "Create first hourly rate");
  await apiPost(api, "/api/hourly-rates", {
    hourlyRate: 19.25,
    currency: "EUR",
    validFrom: "2026-06-01",
    validTo: null
  }, "Create current hourly rate");

  const clientShifts = await apiPost(api, "/api/work-types", {
    name: "Client shifts",
    calculationMethod: "TIME_BASED",
    color: "#F4C95D",
    icon: "C",
    defaultBreakMinutes: 30,
    displayOrder: 1
  }, "Create client shifts work type");
  const nightSupport = await apiPost(api, "/api/work-types", {
    name: "Night support",
    calculationMethod: "TIME_BASED",
    color: "#A78BFA",
    icon: "N",
    defaultBreakMinutes: 45,
    displayOrder: 2
  }, "Create night support work type");
  const deliveries = await apiPost(api, "/api/work-types", {
    name: "Deliveries",
    calculationMethod: "UNIT_BASED",
    color: "#60A5FA",
    icon: "D",
    displayOrder: 3
  }, "Create deliveries work type");
  const housekeeping = await apiPost(api, "/api/work-types", {
    name: "Housekeeping",
    calculationMethod: "UNIT_BASED",
    color: "#2DD4BF",
    icon: "H",
    displayOrder: 4
  }, "Create housekeeping work type");
  const admin = await apiPost(api, "/api/work-types", {
    name: "Admin tasks",
    calculationMethod: "TIME_BASED",
    color: "#FB7185",
    icon: "A",
    defaultBreakMinutes: 15,
    displayOrder: 5
  }, "Create admin work type");

  const clientShiftConfig = await apiPost(api, `/api/work-types/${clientShifts.id}/configurations`, {
    name: "Client shift",
    calculationMode: "TIME_HOURLY",
    defaultBreakMinutes: 30,
    active: true
  }, "Create client shift formula");
  const nightSupportConfig = await apiPost(api, `/api/work-types/${nightSupport.id}/configurations`, {
    name: "Night support",
    calculationMode: "TIME_HOURLY",
    defaultBreakMinutes: 45,
    active: true
  }, "Create night support formula");
  const adminConfig = await apiPost(api, `/api/work-types/${admin.id}/configurations`, {
    name: "Admin tasks",
    calculationMode: "TIME_HOURLY",
    defaultBreakMinutes: 15,
    active: true
  }, "Create admin formula");
  const deliveryOrder = await apiPost(api, `/api/work-types/${deliveries.id}/configurations`, {
    name: "Completed orders",
    calculationMode: "UNITS_PER_HOUR",
    unitLabel: "Order",
    unitSymbol: "orders",
    unitsPerHour: 5,
    displayOrder: 1,
    active: true
  }, "Create order formula");
  const packedBox = await apiPost(api, `/api/work-types/${deliveries.id}/configurations`, {
    name: "Packed boxes",
    calculationMode: "UNITS_PER_HOUR",
    unitLabel: "Box",
    unitSymbol: "boxes",
    unitsPerHour: 8,
    displayOrder: 2,
    active: true
  }, "Create box formula");
  const cleanedRoom = await apiPost(api, `/api/work-types/${housekeeping.id}/configurations`, {
    name: "Cleaned rooms",
    calculationMode: "UNITS_PER_HOUR",
    unitLabel: "Room",
    unitSymbol: "rooms",
    unitsPerHour: 2,
    displayOrder: 1,
    active: true
  }, "Create room formula");
  const inspections = await apiPost(api, `/api/work-types/${housekeeping.id}/configurations`, {
    name: "Room inspections",
    calculationMode: "UNITS_PER_HOUR",
    unitLabel: "Inspection",
    unitSymbol: "checks",
    unitsPerHour: 3,
    displayOrder: 2,
    active: true
  }, "Create inspection formula");

  const absences = [
    ["PUBLIC_HOLIDAY", "2026-05-01", "2026-05-01", "Local public holiday"],
    ["DAY_OFF", "2026-05-21", "2026-05-21", "Planned rest day"],
    ["SICK_LEAVE", "2026-06-12", "2026-06-12", "Short sick leave"],
    ["VACATION", "2026-06-29", "2026-06-30", "Demo vacation"],
    ["SICK_LEAVE", "2026-07-07", "2026-07-07", "Doctor appointment"]
  ];
  for (const [absenceType, startDate, endDate, notes] of absences) {
    await apiPost(api, "/api/absences", { absenceType, startDate, endDate, notes }, `Create absence ${startDate}`);
  }

  const months = [
    [2026, 4, 20, 30],
    [2026, 5, 1, 31],
    [2026, 6, 1, 30],
    [2026, 7, 1, 16]
  ];
  for (const [year, month, first, last] of months) {
    for (let day = first; day <= last; day += 1) {
      const workDate = iso(year, month, day);
      if (isAbsenceDate(workDate)) {
        continue;
      }
      const weekday = new Date(`${workDate}T12:00:00`).getDay();
      if (weekday === 0) {
        continue;
      }
      if (["2026-05-09", "2026-06-13", "2026-07-04"].includes(workDate)) {
        await apiPost(api, "/api/work-records", {
          workDate,
          lines: [{
            workTypeId: nightSupport.id,
            workTypeConfigurationId: nightSupportConfig.id,
            startTime: "22:00",
            endTime: "06:00",
            unpaidBreakMinutes: 45,
            extraPayPercentage: 25
          }],
          notes: "Demo overnight shift"
        }, `Create overnight ${workDate}`);
        continue;
      }
      if (weekday === 6) {
        await apiPost(api, "/api/work-records", {
          workDate,
          lines: [
            { workTypeId: deliveries.id, workTypeConfigurationId: deliveryOrder.id, quantity: 12 + (day % 6) },
            { workTypeId: deliveries.id, workTypeConfigurationId: packedBox.id, quantity: 18 + (day % 8) }
          ],
          notes: "Demo weekend unit work"
        }, `Create weekend units ${workDate}`);
        continue;
      }
      if (weekday === 2 || weekday === 4) {
        await apiPost(api, "/api/work-records", {
          workDate,
          lines: [
            {
              workTypeId: deliveries.id,
              workTypeConfigurationId: deliveryOrder.id,
              quantity: 18 + (day % 7),
              extraPayPercentage: weekday === 4 ? 10 : 0
            },
            {
              workTypeId: deliveries.id,
              workTypeConfigurationId: packedBox.id,
              quantity: 20 + (day % 10),
              extraPayPercentage: weekday === 4 ? 10 : 0
            }
          ],
          notes: "Demo unit-based work"
        }, `Create delivery units ${workDate}`);
        if (weekday === 4) {
          await apiPost(api, "/api/work-records", {
            workDate,
            lines: [{
              workTypeId: admin.id,
              workTypeConfigurationId: adminConfig.id,
              startTime: "17:15",
              endTime: "19:00",
              unpaidBreakMinutes: 0
            }],
            notes: "Demo evening admin wrap-up"
          }, `Create admin ${workDate}`);
        }
        continue;
      }
      const isShort = weekday === 3 && day % 2 === 0;
      await apiPost(api, "/api/work-records", {
        workDate,
        lines: [{
          workTypeId: clientShifts.id,
          workTypeConfigurationId: clientShiftConfig.id,
          startTime: isShort ? "09:00" : "08:00",
          endTime: isShort ? "14:30" : weekday === 5 ? "18:00" : "16:30",
          unpaidBreakMinutes: isShort ? 15 : 30,
          extraPayPercentage: weekday === 5 ? 15 : 0
        }],
        notes: "Demo time-based shift"
      }, `Create shift ${workDate}`);
    }
  }

  await apiPost(api, "/api/work-records", {
    workDate: screenshotDate,
    lines: [
      { workTypeId: housekeeping.id, workTypeConfigurationId: cleanedRoom.id, quantity: 7 },
      { workTypeId: housekeeping.id, workTypeConfigurationId: inspections.id, quantity: 4 }
    ],
    notes: "Demo same-day mixed work"
  }, "Create screenshot day housekeeping");

  await api.dispose();
  return { email, password };
}

async function login(page, user) {
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(`${baseURL}/app`, { timeout: 30_000 });
}

async function screenshotLocator(page, selector, name, options = {}) {
  const locator = typeof selector === "string" ? page.locator(selector).first() : selector;
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(650);
  const png = resolve(outputDir, `${name}.png`);
  const webp = resolve(outputDir, `${name}.webp`);
  await locator.screenshot({ path: png, animations: "disabled", ...options });
  execFileSync("magick", [png, "-quality", "82", "-define", "webp:method=6", webp], { stdio: "pipe" });
  rmSync(png);
}

async function captureAssets(user) {
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true, force: true });
  }
  mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    locale: "en-US",
    deviceScaleFactor: 1
  });
  const page = await desktop.newPage();
  await login(page, user);

  await page.goto(`${baseURL}/app`, { waitUntil: "networkidle" });
  await screenshotLocator(page, "main.screen-shell", "dashboard-desktop");

  await page.goto(`${baseURL}/statistics?period=month&metric=GROSS&heatmapMetric=WORKED_HOURS&productivityMetric=TOTAL_UNITS&productivityGrouping=TOTAL`, { waitUntil: "networkidle" });
  await screenshotLocator(page, "main.screen-shell", "statistics-overview");
  await screenshotLocator(page, page.getByRole("heading", { name: "Compare periods" }).locator("xpath=ancestor::section[1]"), "statistics-comparison");
  await screenshotLocator(page, page.getByRole("heading", { name: "Estimated end of period" }).locator("xpath=ancestor::section[1]"), "statistics-forecast");
  await screenshotLocator(page, page.getByRole("heading", { name: "Unit productivity" }).locator("xpath=ancestor::section[1]"), "statistics-productivity");
  await screenshotLocator(page, page.getByRole("heading", { name: "Activity heatmap" }).locator("xpath=ancestor::section[1]"), "statistics-heatmap");

  await page.goto(`${baseURL}/calendar`, { waitUntil: "networkidle" });
  await screenshotLocator(page, "main.screen-shell", "calendar-desktop");

  await page.goto(`${baseURL}/records/new?date=${screenshotDate}`, { waitUntil: "networkidle" });
  await page.getByLabel("Activity").selectOption({ label: "Client shifts" });
  await page.getByRole("textbox", { name: "Start" }).fill("08:30");
  await page.getByRole("textbox", { name: "End" }).fill("17:15");
  await page.getByRole("spinbutton", { name: "Break (minutes)" }).fill("30");
  await page.getByRole("spinbutton", { name: "Extra pay (%)" }).fill("15");
  await screenshotLocator(page, "main.screen-shell", "entry-form");

  await desktop.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "en-US",
    isMobile: true,
    deviceScaleFactor: 2
  });
  const mobilePage = await mobile.newPage();
  await login(mobilePage, user);
  await mobilePage.goto(`${baseURL}/app`, { waitUntil: "networkidle" });
  await screenshotLocator(mobilePage, "main.screen-shell", "dashboard-mobile");
  await mobile.close();
  await browser.close();
}

const user = await seedDemoData();
await captureAssets(user);

console.log(`Landing screenshots written to ${outputDir}`);

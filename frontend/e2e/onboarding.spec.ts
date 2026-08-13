import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const currentUser = { account:{id:"e2e-user",email:"worker@example.com",emailVerified:true,status:"ACTIVE",lastLoginAt:null},profile:null,preferences:{id:"p",language:"en",timezone:"Europe/Berlin",currency:"EUR",firstDayOfWeek:"MONDAY",dateFormat:"dd/MM/yyyy",timeFormat:"H24",theme:"LIGHT",defaultBreakMinutes:30,preferredDailyMinutes:480,paidSickLeave:true,paidVacation:true,onboardingCompleted:false,trackingSetupVersionCompleted:0} };

async function openSetup(page: Page) {
  await page.addInitScript(() => localStorage.setItem("alveryn.session","1"));
  await page.route("**/api/auth/refresh", route => route.fulfill({json:{data:{accessToken:"e2e",tokenType:"Bearer",accessTokenExpiresIn:900,user:{id:"e2e-user",email:"worker@example.com",emailVerified:true,status:"ACTIVE",lastLoginAt:null}}}}));
  await page.route(/\/api\/me(?:\?.*)?$/, route => route.fulfill({json:{data:currentUser}}));
  await page.route("**/api/employments", route => route.fulfill({json:{data:[]}}));
  await page.goto("/tracking-setup");
  await page.getByLabel("First name").fill("Mia"); await page.getByLabel("Last name").fill("Taylor"); await page.getByRole("button",{name:"Continue"}).click();
}

for (const mode of ["By the hour","By completed unit","Fixed-price work"] as const) {
  test(`submits the atomic ${mode} setup once`, async ({page}) => {
    await openSetup(page); await page.getByRole("radio",{name:mode}).click();
    if(mode==="By the hour") await page.getByLabel("Hourly rate").fill("18.50");
    if(mode==="By completed unit") { await page.getByLabel("Unit", { exact: true }).fill("m²"); await page.getByLabel("Rate per unit").fill("4.80"); }
    await page.getByRole("button",{name:"Continue"}).click();
    let requests=0; let payload:Record<string,unknown>|null=null;
    await page.route("**/api/onboarding/initial-setup", async route => {requests+=1;payload=route.request().postDataJSON();await new Promise(resolve=>setTimeout(resolve,150));await route.fulfill({json:{data:{employmentId:"e",workTypeId:"w",status:{onboardingCompleted:true}}}});});
    const submit=page.getByRole("button",{name:"Create my record"}); await submit.dblclick();
    await expect.poll(()=>requests).toBe(1);
    expect(payload?.compensationType).toBe(mode==="By the hour"?"HOURLY":mode==="By completed unit"?"PER_UNIT":"FIXED_AMOUNT");
    if(mode==="Fixed-price work") expect(payload).toMatchObject({hourlyRate:null,ratePerUnit:null,unitLabel:null});
  });
}

test("restores the versioned draft after refresh", async ({page}) => {
  await openSetup(page); await page.getByRole("radio",{name:"By completed unit"}).click(); await page.getByLabel("Unit", { exact: true }).fill("rooms");
  await page.reload(); await expect(page.getByText("Your saved setup has been restored.")).toBeVisible(); await expect(page.getByRole("radio",{name:"By completed unit"})).toBeChecked(); await expect(page.getByLabel("Unit", { exact: true })).toHaveValue("rooms");
});

test("keeps the final action reachable without horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openSetup(page);
  await page.getByLabel("Hourly rate").fill("18.50");
  await page.getByRole("button", { name: "Continue" }).click();
  const submit = page.getByRole("button", { name: "Create my record" });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

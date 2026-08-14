import { expect, test, type Page, type Route } from "@playwright/test";

test.use({ serviceWorkers: "block" });

const organizationId = "org-puiu";
const unitId = "unit-munich";
const planId = "plan-kw33";
const weekStart = "2026-08-10";

type RequestLog = { method: string; path: string; headers: Record<string, string>; body: unknown };
type ReviewMockOptions = { blocker?: boolean; stalePublish?: boolean; theme?: "LIGHT" | "DARK"; language?: string };
type ReviewMockState = {
  revision: number;
  published: boolean;
  stalePublish: boolean;
  requests: RequestLog[];
};

test.describe("authenticated Business Review and Publish", () => {
  test("acknowledges the canonical review, publishes, and opens the immutable version", async ({ page }) => {
    const state = await installReviewMocks(page);
    await openReview(page, 1440, 980);

    await expect(page.getByRole("heading", { level: 1, name: "Is every requirement covered?" })).toBeVisible();
    await expect(page.getByText("98 / 99")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish week" })).toBeDisabled();
    await expect(page.getByText("Unpublished changes").first()).toBeVisible();
    await expectConsistentReviewState(page, "UNPUBLISHED_CHANGES");
    await capture(page, "review-desktop-warning-light.png");
    await recordingBeat(page);

    await page.getByRole("checkbox", { name: /reviewed and acknowledge/ }).check();
    await page.getByLabel("Publication note (optional)").fill("Hotel confirmed the remaining position");
    await expectConsistentReviewState(page, "READY_TO_PUBLISH");
    await capture(page, "review-desktop-ready-light.png");
    await recordingBeat(page);
    await page.getByRole("button", { name: "Publish week" }).click();

    await expect(page.getByRole("heading", { name: "Version v3 published" })).toBeVisible();
    await expect(page.getByText("98 of 99 required positions covered")).toBeVisible();
    await expect(page.getByText("Published v3 · Draft matches this version").first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /reviewed and acknowledge/ })).toHaveCount(0);
    await expectConsistentReviewState(page, "PUBLISHED_CURRENT");
    await capture(page, "review-desktop-published-light.png");
    await recordingBeat(page);

    const request = state.requests.find((item) => item.method === "POST" && item.path.endsWith("/publish"));
    expect(request?.headers["if-match"]).toBe('"plan-plan-kw33-rev-8"');
    expect(request?.headers["idempotency-key"]).toBeTruthy();
    expect(request?.body).toEqual({
      acknowledgementKeys: ["UNDERCOVERAGE:requirement-spa-sun"],
      publicationNote: "Hotel confirmed the remaining position",
    });

    await page.getByRole("button", { name: "Open immutable version" }).click();
    const dialog = page.getByRole("dialog", { name: "Immutable version v3" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Ana Dumitru")).toBeVisible();
    await expect(dialog.getByText("Changes from v2 to v3")).toBeVisible();
    await capture(page, "review-desktop-version-v3-light.png");
    await recordingBeat(page);

    await page.getByRole("button", { name: "Close version detail" }).click();
    state.revision += 1;
    await page.reload();
    await expect(page.getByText("Unpublished changes").first()).toBeVisible();
    await expectConsistentReviewState(page, "UNPUBLISHED_CHANGES");
    await capture(page, "review-desktop-unpublished-v3-light.png");
    await recordingBeat(page);

    await page.getByRole("checkbox", { name: /reviewed and acknowledge/ }).check();
    await expectConsistentReviewState(page, "READY_TO_PUBLISH");
  });

  test("keeps blocking conflicts separate and never enables publish", async ({ page }) => {
    await installReviewMocks(page, { blocker: true });
    await openReview(page, 1366, 900);

    await expect(page.getByText("Blocking conflicts")).toBeVisible();
    await expect(page.getByText("A person has overlapping assignments.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish week" })).toBeDisabled();
    await expectConsistentReviewState(page, "BLOCKED");
    await expect(page.getByRole("link", { name: "Open Schedule" })).toBeVisible();
    await capture(page, "review-desktop-blocked-light.png");
  });

  test("reloads a stale review without replaying publish", async ({ page }) => {
    const state = await installReviewMocks(page, { stalePublish: true });
    await openReview(page, 1280, 800);

    await page.getByRole("checkbox", { name: /reviewed and acknowledge/ }).check();
    await page.getByRole("button", { name: "Publish week" }).click();
    await expect(page.getByText(/plan changed during review/)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /reviewed and acknowledge/ })).not.toBeChecked();
    expect(state.requests.filter((item) => item.method === "POST" && item.path.endsWith("/publish"))).toHaveLength(1);
  });

  for (const viewport of [
    { width: 320, height: 568, theme: "light" as const },
    { width: 375, height: 812, theme: "dark" as const },
    { width: 768, height: 1024, theme: "light" as const },
  ]) {
    test(`keeps review, publish, and version history usable at ${viewport.width}px`, async ({ page }) => {
      await installReviewMocks(page, { theme: viewport.theme === "dark" ? "DARK" : "LIGHT" });
      await openReview(page, viewport.width, viewport.height, viewport.theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", viewport.theme);
      await expect(page.getByRole("button", { name: "Publish week" })).toBeVisible();
      await page.getByRole("button", { name: "Publish week" }).scrollIntoViewIfNeeded();
      await capture(page, `review-${viewport.width}-${viewport.theme}.png`);
      await recordingBeat(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

      await page.getByRole("button", { name: "Open version v2" }).click();
      await expect(page.getByRole("dialog", { name: "Immutable version v2" })).toBeVisible();
      await capture(page, `review-${viewport.width}-${viewport.theme}-version.png`);
      await recordingBeat(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }

  test("keeps the published-current verdict coherent on mobile dark", async ({ page }) => {
    const state = await installReviewMocks(page, { theme: "DARK" });
    state.published = true;
    await openReview(page, 375, 812, "dark");

    await expect(page.getByText("Published v3 · Draft matches this version").first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /reviewed and acknowledge/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Publish week" })).toHaveCount(0);
    await expectConsistentReviewState(page, "PUBLISHED_CURRENT");
    await capture(page, "review-375-dark-published-current.png");
  });

  test("derives unpublished changes from the backend in a fresh tab without browser review state", async ({ page }) => {
    await installReviewMocks(page);
    await openReview(page, 1280, 800);

    await expect(page.getByText("Unpublished changes").first()).toBeVisible();
    await expectConsistentReviewState(page, "UNPUBLISHED_CHANGES");
    await expect(page.getByRole("checkbox", { name: /reviewed and acknowledge/ })).not.toBeChecked();
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);

    await page.reload();
    await expect(page.getByText("Unpublished changes").first()).toBeVisible();
    await expectConsistentReviewState(page, "UNPUBLISHED_CHANGES");
    await expect(page.getByRole("checkbox", { name: /reviewed and acknowledge/ })).not.toBeChecked();
    expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  });

  test("keeps the review readable in desktop dark mode and translated in all supported languages", async ({ page }) => {
    const state = await installReviewMocks(page, { theme: "DARK", language: "en" });
    state.published = true;
    await openReview(page, 1440, 980, "dark", "en");
    await expectConsistentReviewState(page, "PUBLISHED_CURRENT");
    await capture(page, "review-desktop-dark.png");

    const expected = [
      ["de", "Ist jeder Bedarf abgedeckt?"],
      ["ro", "Este acoperit fiecare necesar?"],
      ["ru", "Закрыта ли каждая потребность?"],
      ["en", "Is every requirement covered?"],
    ] as const;
    for (const [language, title] of expected) {
      await page.getByLabel(/Language|Sprache|Limbă|Язык/).selectOption(language);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    }
  });
});

async function recordingBeat(page: Page) {
  if (process.env.ALVERYN_E2E_RECORD_VIDEO === "true") {
    await page.waitForTimeout(850);
  }
}

async function expectConsistentReviewState(page: Page, expected: string) {
  const states = await page.locator("[data-review-state]").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-review-state")),
  );
  expect(states.length).toBeGreaterThanOrEqual(4);
  expect(new Set(states)).toEqual(new Set([expected]));
}

async function installReviewMocks(page: Page, options: ReviewMockOptions = {}) {
  const state: ReviewMockState = {
    revision: 8,
    published: false,
    stalePublish: options.stalePublish ?? false,
    requests: [],
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const method = request.method();
    const headers = request.headers();
    let body: unknown = null;
    try { body = request.postDataJSON(); } catch { body = request.postData(); }
    state.requests.push({ method, path, headers, body });

    if (path === "/api/auth/refresh") return json(route, authTokens());
    if (path === "/api/me") return json(route, currentUser(options.theme ?? "LIGHT", options.language ?? "en"));
    if (path === "/api/organizations") return json(route, [{ id: organizationId, name: "PUIU GmbH", type: "BUSINESS", timezone: "Europe/Berlin", role: "OWNER" }]);
    if (path === `/api/organizations/${organizationId}/units`) return json(route, [{ id: unitId, parentId: null, name: "Hotel München", type: "LOCATION", checkInMode: "OPTIONAL", active: true, displayOrder: 0 }]);
    if (path === `/api/organizations/${organizationId}/access`) return json(route, { permissions: ["VIEW_SCHEDULE", "MANAGE_SCHEDULE", "PUBLISH_SCHEDULE", "MANAGE_SETTINGS"] });
    if (path === `/api/organizations/${organizationId}/staffing/plans` && method === "GET") {
      return json(route, { found: true, plan: planHeader(state) }, 200, { ETag: planEtag(state.revision) });
    }
    if (path.endsWith(`/${planId}/coverage`) && method === "GET") return json(route, coverageResponse(options.blocker ?? false, state), 200, { ETag: planEtag(state.revision) });
    if (path.endsWith(`/${planId}/review`) && method === "GET") return json(route, reviewResponse(options.blocker ?? false, state), 200, { ETag: planEtag(state.revision) });
    if (path.endsWith(`/${planId}/versions`) && method === "GET") return json(route, versionsResponse(state), 200, { ETag: '"versions-plan-kw33"' });
    if (path.match(/\/versions\/\d+$/) && method === "GET") {
      const versionNumber = Number(path.split("/").at(-1));
      return json(route, versionDetail(versionNumber), 200, { ETag: `"version-${versionNumber}-immutable"` });
    }
    if (path.endsWith(`/${planId}/publish`) && method === "POST") {
      if (state.stalePublish) {
        state.stalePublish = false;
        state.revision += 1;
        return apiError(route, 412, "STALE_PLAN_REVISION", "Stale plan revision");
      }
      state.published = true;
      return json(route, publishResult(), 201, {
        ETag: '"version-3-immutable"',
        Location: `/api/organizations/${organizationId}/staffing/plans/${planId}/versions/3`,
      });
    }
    return apiError(route, 501, "UNMOCKED_REQUEST", `${method} ${path}`);
  });
  return state;
}

function planHeader(state: ReviewMockState) {
  const publishedRevision = state.published ? 8 : 7;
  return {
    planId,
    organizationId,
    unitId,
    unitName: "Hotel München",
    weekStart,
    weekEnd: "2026-08-16",
    timezone: "Europe/Berlin",
    status: "ACTIVE",
    draftRevision: state.revision,
    etag: planEtag(state.revision),
    latestPublishedVersion: state.published ? {
      versionId: "version-3",
      versionNumber: 3,
      sourceDraftRevision: state.revision,
      publishedAt: "2026-08-14T13:00:00Z",
      publicationKind: "ATOMIC_WEEKLY",
      coverageBasis: "CANONICAL_V94",
      checksum: "checksum-v3",
    } : {
      versionId: "version-2",
      versionNumber: 2,
      sourceDraftRevision: 7,
      publishedAt: "2026-08-13T12:00:00Z",
      publicationKind: "ATOMIC_WEEKLY",
      coverageBasis: "CANONICAL_V94",
      checksum: "checksum-v2",
    },
    publishedRevision,
    publishedAt: state.published ? "2026-08-14T13:00:00Z" : "2026-08-13T12:00:00Z",
    hasUnpublishedChanges: state.revision > publishedRevision,
    capabilities: { view: true, manage: true, publish: true },
  };
}

function coverageTotals() {
  return { required: 99, rawAssigned: 98, effectiveAssigned: 98, covered: 98, missing: 1, overstaffed: 0, percentage: 98.99, openPositions: 1 };
}

function warningIssue() {
  return {
    issueKey: "UNDERCOVERAGE:requirement-spa-sun",
    code: "UNDERCOVERAGE",
    severity: "WARNING",
    date: "2026-08-16",
    requirementId: "requirement-spa-sun",
    assignmentId: null,
    membershipId: null,
    messageKey: "staffing.issue.undercoverage",
    parameters: { effectiveAssigned: "1", required: "2" },
    acknowledgementRequired: true,
    publishBlocking: false,
  };
}

function blockerIssue() {
  return {
    issueKey: "INCOMPATIBLE_OVERLAP:assignment-ana",
    code: "INCOMPATIBLE_OVERLAP",
    severity: "BLOCKING_CONFLICT",
    date: "2026-08-16",
    requirementId: "requirement-spa-sun",
    assignmentId: "assignment-ana",
    membershipId: "member-ana",
    messageKey: "staffing.issue.incompatible_overlap",
    parameters: {},
    acknowledgementRequired: false,
    publishBlocking: true,
  };
}

function coverageResponse(blocker: boolean, state: ReviewMockState) {
  const issues = blocker ? [blockerIssue(), warningIssue()] : [warningIssue()];
  return {
    planId, organizationId, unitId, weekStart, draftRevision: state.revision,
    etag: planEtag(state.revision), totals: coverageTotals(),
    requirements: [{
      requirementId: "requirement-spa-sun", planDayId: "day-sun", date: "2026-08-16",
      workTypeId: "spa-s", workTypeCode: "SPA S", workTypeName: "Spa Spät",
      startTime: "12:00:00", endTime: "20:30:00", totals: { ...coverageTotals(), required: 2, rawAssigned: 1, effectiveAssigned: 1, covered: 1, missing: 1, percentage: 50, openPositions: 1 },
      assignmentIds: ["assignment-mara"], effectiveAssignmentIds: ["assignment-mara"], issueKeys: issues.map((issue) => issue.issueKey),
    }],
    days: [{ date: "2026-08-16", totals: coverageTotals(), issueKeys: issues.map((issue) => issue.issueKey) }],
    issues,
    blockingIssueCount: blocker ? 1 : 0,
    warningCount: 1,
    informationCount: 0,
    publishable: !blocker,
  };
}

function reviewResponse(blocker: boolean, state: ReviewMockState) {
  const groups = blocker
    ? [
        { severity: "BLOCKING_CONFLICT", count: 1, issues: [blockerIssue()] },
        { severity: "WARNING", count: 1, issues: [warningIssue()] },
      ]
    : [{ severity: "WARNING", count: 1, issues: [warningIssue()] }];
  return {
    planId, organizationId, unitId, weekStart, draftRevision: state.revision,
    etag: planEtag(state.revision), coverage: coverageTotals(), groups,
    blockingIssueCount: blocker ? 1 : 0,
    warningCount: 1,
    informationCount: 0,
    publishable: !blocker,
    requiredAcknowledgementKeys: [warningIssue().issueKey],
  };
}

function versionsResponse(state: ReviewMockState) {
  const versions = state.published ? [versionSummary(3, true), versionSummary(2, false)] : [versionSummary(2, true)];
  return { planId, organizationId, unitId, limit: 8, nextBeforeVersion: null, hasMore: false, versions };
}

function versionSummary(versionNumber: number, latest: boolean) {
  return {
    versionId: `version-${versionNumber}`, versionNumber, sourceDraftRevision: versionNumber === 3 ? 8 : 7,
    required: versionNumber === 3 ? 99 : 98, rawAssigned: 98, effectiveAssigned: 98,
    covered: 98, missing: versionNumber === 3 ? 1 : 0, overstaffed: 0,
    percentage: versionNumber === 3 ? 98.99 : 100, coverageBasis: "CANONICAL_V94",
    warningCount: versionNumber === 3 ? 1 : 0, checksum: `checksum-v${versionNumber}`,
    publicationKind: "ATOMIC_WEEKLY", sourceDraftComplete: true,
    publisherDisplayName: "Eusebiu Jacot", publishedAt: versionNumber === 3 ? "2026-08-14T13:00:00Z" : "2026-08-13T12:00:00Z", latest,
  };
}

function versionDetail(versionNumber: number) {
  const latest = versionNumber === 3;
  return {
    ...versionSummary(versionNumber, latest), planId, organizationId, unitId,
    timezone: "Europe/Berlin", weekStart,
    days: [{ sourcePlanDayId: "day-sun", date: "2026-08-16", roomsContext: 10, source: "MANUAL" }],
    requirements: [{
      sourceRequirementId: "requirement-spa-sun", sourcePlanDayId: "day-sun", date: "2026-08-16",
      unitId, unitName: "Hotel München", workTypeId: "spa-s", workTypeCode: "SPA S", workTypeName: "Spa Spät",
      startTime: "12:00:00", endTime: "20:30:00", breakMinutes: 30,
      requiredWorkers: latest ? 2 : 1, requiredQuantity: null, legacyPublicationStatus: "PUBLISHED",
    }],
    assignments: [{
      sourceAssignmentId: "assignment-ana", sourceRequirementId: "requirement-spa-sun",
      membershipId: "member-ana", memberDisplayName: "Ana Dumitru", membershipStatus: "ACTIVE",
      date: "2026-08-16", unitId, unitName: "Hotel München", workTypeId: "spa-s",
      workTypeCode: "SPA S", workTypeName: "Spa Spät", startTime: "12:00:00", endTime: "20:30:00",
      status: "ASSIGNED", checkInMode: null, checkedInAt: null, checkedOutAt: null,
    }],
    memberDays: [], acknowledgements: latest ? [{ issueKey: warningIssue().issueKey, severity: "WARNING", acknowledgedAt: "2026-08-14T13:00:00Z" }] : [],
  };
}

function publishResult() {
  return {
    planId, versionId: "version-3", versionNumber: 3, sourceDraftRevision: 8,
    publishedRevision: 8, publishedAt: "2026-08-14T13:00:00Z", publicationKind: "ATOMIC_WEEKLY",
    canonicalCoverage: { required: 99, rawAssigned: 98, effectiveAssigned: 98, covered: 98, missing: 1, overstaffed: 0, percentage: 98.99 },
    warningCount: 1, checksum: "checksum-v3", idempotentReplay: false,
  };
}

async function openReview(page: Page, width: number, height: number, theme: "light" | "dark" = "light", language = "en") {
  await page.setViewportSize({ width, height });
  await page.addInitScript(({ selectedTheme, selectedLanguage }) => {
    localStorage.setItem("alveryn.session", "1");
    localStorage.setItem("alveryn.publicTheme", selectedTheme);
    localStorage.setItem("alveryn.language", selectedLanguage);
  }, { selectedTheme: theme, selectedLanguage: language });
  await page.goto(`/business/${organizationId}/plan/review?unit=${unitId}&week=${weekStart}`);
  await expect(page.locator(".business-review")).toBeVisible();
}

function currentUser(theme: "LIGHT" | "DARK", language: string) {
  return {
    account: { id: "manager-user", email: "manager@example.com", emailVerified: true, status: "ACTIVE", lastLoginAt: null },
    profile: { firstName: "Mara", lastName: "Manager" },
    preferences: { id: "preferences-manager", language, timezone: "Europe/Berlin", currency: "EUR", firstDayOfWeek: "MONDAY", dateFormat: "dd/MM/yyyy", timeFormat: "H24", theme, defaultBreakMinutes: 30, preferredDailyMinutes: 480, paidSickLeave: true, paidVacation: true, onboardingCompleted: true, trackingSetupVersionCompleted: 1 },
  };
}

function authTokens() {
  return { accessToken: "e2e-business-token", tokenType: "Bearer", accessTokenExpiresIn: 900, user: { id: "manager-user", email: "manager@example.com", emailVerified: true, status: "ACTIVE", lastLoginAt: null } };
}

function planEtag(revision: number) { return `"plan-${planId}-rev-${revision}"`; }
function json(route: Route, data: unknown, status = 200, headers: Record<string, string> = {}) { return route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify({ data }) }); }
function apiError(route: Route, status: number, code: string, message: string) { return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ status, code, message, errors: [], path: route.request().url(), timestamp: new Date(0).toISOString() }) }); }

async function capture(page: Page, name: string) {
  const directory = process.env.ALVERYN_D3_ARTIFACT_DIR;
  if (directory) await page.screenshot({ path: `${directory}/${name}`, fullPage: true });
}

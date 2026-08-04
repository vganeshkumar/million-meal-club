import { test, expect, type Page } from "@playwright/test";

/**
 * Covers specs/features/019-dashboard-profile-tab-and-proof-relocation:
 * - The homepage no longer has a "Gallery" nav link or #gallery section.
 * - "My Donations" gets a left-nav Profile tab that toggles the content
 *   frame without a page reload.
 * - Scheduling a donation event accepts the new signup-style fields
 *   (packet count, delivery role, partner charity, notes), which
 *   round-trip through the API.
 */

const BACKEND = "http://localhost:8001";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signInAsDummyAdmin(page: Page) {
  await page
    .locator("header")
    .getByRole("button", { name: "Sign In", exact: true })
    .click();
  await page.getByLabel("Username").fill("dummy_user");
  await page.getByLabel("Password").fill("dummy_password");
  await page.getByRole("button", { name: "Dummy Login" }).click();
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toBeVisible();
}

test("homepage no longer shows a Gallery nav link or section", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator("header").getByRole("link", { name: "Gallery" }),
  ).toHaveCount(0);
  await expect(page.locator("#gallery")).toHaveCount(0);
  await expect(page.getByText("Show us you delivered.")).toHaveCount(0);
});

test("My Donations navigation switches between Overview, Schedule, and Profile without reloading", async ({
  page,
}) => {
  const donorName = `Nav Toggle Donor ${Date.now()}`;
  const donorEmail = uniqueEmail("nav-toggle-donor");
  const localUsername = donorName.toLowerCase().replace(/\s+/g, "_");

  const seed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "donor",
      name: donorName,
      email: donorEmail,
      location: "Austin, TX",
      country: "United States",
      packet_count: 60,
      delivery_role: "self",
      donor_story: "Testing the nav toggle.",
      commit_50k_4yr: true,
      agree_publish_story: true,
    },
  });
  expect(seed.ok()).toBeTruthy();
  const signupId = (await seed.json()).signup_id as string;

  await page.goto("/");
  await signInAsDummyAdmin(page);
  const approve = await page.request.post(
    `${BACKEND}/api/admin/signups/${signupId}/approve`,
  );
  expect(approve.ok()).toBeTruthy();
  await page.request.post(`${BACKEND}/api/auth/logout`);

  await page.goto("/");
  await page
    .locator("header")
    .getByRole("button", { name: "Sign In", exact: true })
    .click();
  await page.getByLabel("Username").fill(localUsername);
  await page.getByLabel("Password").fill("dummy_password");
  await page.getByRole("button", { name: "Dummy Login" }).click();
  await page.getByRole("link", { name: "My Donations", exact: true }).click();

  // Overview is the default: stats visible, profile form and the
  // schedule-events content (now behind their own nav links) are not.
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("profile-form")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Schedule new donation events" }),
  ).toHaveCount(0);

  await page.getByTestId("dashboard-nav-schedule").click();
  await expect(
    page.getByRole("heading", { name: "Schedule new donation events" }),
  ).toBeVisible();
  await expect(page.getByTestId("profile-form")).toHaveCount(0);

  await page.getByTestId("dashboard-nav-profile").click();
  await expect(page.getByTestId("profile-form")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Schedule new donation events" }),
  ).toHaveCount(0);

  await page.getByTestId("dashboard-nav-overview").click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("profile-form")).toHaveCount(0);
});

test("scheduling a donation accepts packet count, delivery role, and notes", async ({
  page,
}) => {
  const donorName = `Full Schedule Donor ${Date.now()}`;
  const donorEmail = uniqueEmail("full-schedule-donor");
  const localUsername = donorName.toLowerCase().replace(/\s+/g, "_");
  const location = `Full Schedule Site ${Date.now()}`;

  const seed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "donor",
      name: donorName,
      email: donorEmail,
      location: "Austin, TX",
      country: "United States",
      packet_count: 60,
      delivery_role: "self",
      donor_story: "Testing the full schedule form.",
      commit_50k_4yr: true,
      agree_publish_story: true,
    },
  });
  expect(seed.ok()).toBeTruthy();
  const signupId = (await seed.json()).signup_id as string;

  await page.goto("/");
  await signInAsDummyAdmin(page);
  const approve = await page.request.post(
    `${BACKEND}/api/admin/signups/${signupId}/approve`,
  );
  expect(approve.ok()).toBeTruthy();
  await page.request.post(`${BACKEND}/api/auth/logout`);

  await page.goto("/");
  await page
    .locator("header")
    .getByRole("button", { name: "Sign In", exact: true })
    .click();
  await page.getByLabel("Username").fill(localUsername);
  await page.getByLabel("Password").fill("dummy_password");
  await page.getByRole("button", { name: "Dummy Login" }).click();
  await page.getByRole("link", { name: "My Donations", exact: true }).click();
  await page.getByTestId("dashboard-nav-schedule").click();

  const scheduleForm = page.getByTestId("schedule-donation-form");
  await scheduleForm.waitFor();
  await scheduleForm
    .getByLabel("Exact Address", { exact: true })
    .fill(location);
  await scheduleForm.getByLabel("Date", { exact: true }).fill("2026-10-01");
  await scheduleForm.getByLabel("Start Time", { exact: true }).fill("09:00");
  await scheduleForm.getByLabel("End Time", { exact: true }).fill("11:00");
  await scheduleForm
    .getByLabel("Number of Food Packets")
    .fill("42");
  // Delivery role and partner charity are mutually exclusive (matching the
  // home page's Join In form) — this covers the delivery-role path; the
  // partner-charity field goes through the same create call, just via the
  // other branch of that OR.
  await scheduleForm.getByLabel("A volunteer will collect & deliver").check();
  await scheduleForm.getByLabel("Notes").fill("Ring the back doorbell.");
  await scheduleForm.getByRole("button", { name: "Schedule Donation" }).click();
  await page.getByTestId("dashboard-nav-scheduled").click();
  await expect(page.getByText(location)).toBeVisible();

  const mine = await page.request.get(`${BACKEND}/api/donation-events/mine`);
  const events = (await mine.json()) as Array<{
    location: string;
    packetCount?: number;
    deliveryRole?: string;
    partnerCharity?: string;
    notes?: string;
  }>;
  const created = events.find((e) => e.location === location);
  expect(created).toBeTruthy();
  expect(created?.packetCount).toBe(42);
  expect(created?.deliveryRole).toBe("volunteer_needed");
  expect(created?.notes).toBe("Ring the back doorbell.");
});

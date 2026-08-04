import { test, expect, type Page } from "@playwright/test";

/**
 * Covers specs/features/017-cancel-donation-events — a donor can cancel a
 * scheduled donation event from "My Donations", which immediately removes
 * it from the public homepage Events feed.
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

test("donor can cancel a scheduled donation event, removing it from the homepage", async ({
  page,
}) => {
  const donorName = `Cancel Flow Donor ${Date.now()}`;
  const donorEmail = uniqueEmail("cancel-flow-donor");
  const location = `Cancel Test Site ${Date.now()}`;

  const seed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "donor",
      name: donorName,
      email: donorEmail,
      location: "Austin, TX",
      country: "United States",
      packet_count: 60,
      delivery_role: "self",
      donor_story: "Testing the cancel flow.",
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

  // Sign in as the donor via the generated local-dev username.
  const donorUsername = donorName
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  await page.goto("/");
  await page
    .locator("header")
    .getByRole("button", { name: "Sign In", exact: true })
    .click();
  await page.getByLabel("Username").fill(donorUsername);
  await page.getByLabel("Password").fill("dummy_password");
  await page.getByRole("button", { name: "Dummy Login" }).click();
  await expect(
    page.getByRole("link", { name: "My Donations", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "My Donations", exact: true }).click();
  await page.getByTestId("dashboard-nav-schedule").click();
  // Wait for the donor profile fetch (and the form it gates) to finish
  // mounting before filling — otherwise a fill can land on a
  // not-yet-final render of the form.
  await page
    .getByRole("heading", { name: "Schedule new donation events" })
    .waitFor();
  const scheduleForm = page.getByTestId("schedule-donation-form");
  await scheduleForm
    .getByLabel("Exact Address", { exact: true })
    .fill(location);
  await scheduleForm.getByLabel("Date", { exact: true }).fill("2026-09-15");
  await scheduleForm.getByLabel("Start Time", { exact: true }).fill("09:00");
  await scheduleForm.getByLabel("End Time", { exact: true }).fill("11:00");
  await scheduleForm.getByRole("button", { name: "Schedule Donation" }).click();
  await page.getByTestId("dashboard-nav-scheduled").click();
  await expect(page.getByText(location)).toBeVisible();

  // Shows up on the public homepage.
  await page.goto("/");
  await expect(
    page.locator("#events").getByText(location, { exact: true }),
  ).toBeVisible();

  // Cancel it from "My Donations" > Scheduled Events.
  await page.getByRole("link", { name: "My Donations", exact: true }).click();
  await page.getByTestId("dashboard-nav-scheduled").click();
  const eventRow = page
    .getByTestId("my-donation-event-card")
    .filter({ hasText: location });
  await eventRow.getByRole("button", { name: "Cancel" }).click();
  // Cancelled events drop out of "Scheduled Events" entirely, rather than
  // staying in the list with a "Cancelled" label.
  await expect(eventRow).toHaveCount(0);

  // Gone from the public homepage.
  await page.goto("/");
  await expect(
    page.locator("#events").getByText(location, { exact: true }),
  ).not.toBeVisible();
});

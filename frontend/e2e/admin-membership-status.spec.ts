import { test, expect, type Page } from "@playwright/test";

/**
 * Covers specs/features/016-admin-membership-status — an admin can disable
 * a previously-approved donor from the new #admin Donors tab, which
 * immediately removes them from the public Featured Donors section (while
 * still showing on the admin tab, marked disabled), and reactivating
 * restores public visibility.
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

test("admin can disable and reactivate a donor, controlling public visibility", async ({
  page,
}) => {
  const name = `Toggle Donor ${Date.now()}`;
  const email = uniqueEmail("toggle-donor");

  const seed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "donor",
      name,
      email,
      location: "Austin, TX",
      country: "United States",
      packet_count: 60,
      delivery_role: "self",
      donor_story: "Testing the disable/reactivate toggle.",
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

  // Active donor shows up publicly.
  await page.goto("/");
  await expect(page.locator("#donors").getByText(name, { exact: true })).toBeVisible();

  // Disable from the admin Donors tab.
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await page.getByRole("button", { name: "Donors", exact: true }).click();
  const donorCard = page.getByTestId("donor-card").filter({ hasText: email });
  await expect(donorCard).toBeVisible();
  await donorCard.getByRole("button", { name: "Disable" }).click();
  await expect(donorCard.getByText("disabled")).toBeVisible();

  // Gone from the public homepage.
  await page.goto("/");
  await expect(
    page.locator("#donors").getByText(name, { exact: true }),
  ).not.toBeVisible();

  // Still visible, marked disabled, on the admin tab.
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await page.getByRole("button", { name: "Donors", exact: true }).click();
  await expect(donorCard).toBeVisible();
  await expect(donorCard.getByText("disabled")).toBeVisible();

  // Reactivate restores public visibility.
  await donorCard.getByRole("button", { name: "Reactivate" }).click();
  await expect(donorCard.getByText("active", { exact: true })).toBeVisible();

  await page.goto("/");
  await expect(page.locator("#donors").getByText(name, { exact: true })).toBeVisible();
});

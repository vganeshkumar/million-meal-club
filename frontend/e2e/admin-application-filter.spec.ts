import { test, expect, type Page } from "@playwright/test";

/**
 * Covers specs/features/013-admin-application-filter — the Applications
 * tab's All/Donor/Volunteer control narrows the already-fetched list by
 * `mode`, purely client-side.
 */

const BACKEND = "http://localhost:8001";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signInAsDummyAdmin(page: Page) {
  // Scoped to the header — avoids ambiguity if a "Sign In" prompt is
  // ever added elsewhere on the page.
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

test("admin can filter Applications by donor or volunteer", async ({
  page,
}) => {
  const donorEmail = uniqueEmail("filter-donor");
  const volunteerEmail = uniqueEmail("filter-volunteer");

  const donorSeed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "donor",
      name: "Filter Test Donor",
      email: donorEmail,
      location: "Austin, TX",
      country: "United States",
      packet_count: 75,
      delivery_role: "self",
      donor_story: "Testing the admin filter.",
      commit_50k_4yr: true,
      agree_publish_story: true,
    },
  });
  expect(donorSeed.ok()).toBeTruthy();

  const volunteerSeed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "volunteer",
      name: "Filter Test Volunteer",
      email: volunteerEmail,
      location: "Round Rock, TX",
      country: "United States",
      packets_per_trip: 20,
      availability: "Weekends",
    },
  });
  expect(volunteerSeed.ok()).toBeTruthy();

  await page.goto("/");
  await signInAsDummyAdmin(page);
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pending Applications" }),
  ).toBeVisible();

  const donorCard = page.getByTestId("signup-card").filter({ hasText: donorEmail });
  const volunteerCard = page
    .getByTestId("signup-card")
    .filter({ hasText: volunteerEmail });

  // All (default) — both visible.
  await expect(donorCard).toBeVisible();
  await expect(volunteerCard).toBeVisible();

  // Donor filter — only the donor card.
  await page.getByRole("button", { name: "donor", exact: true }).click();
  await expect(donorCard).toBeVisible();
  await expect(volunteerCard).not.toBeVisible();

  // Volunteer filter — only the volunteer card.
  await page.getByRole("button", { name: "volunteer", exact: true }).click();
  await expect(volunteerCard).toBeVisible();
  await expect(donorCard).not.toBeVisible();

  // Back to all.
  await page.getByRole("button", { name: "all", exact: true }).click();
  await expect(donorCard).toBeVisible();
  await expect(volunteerCard).toBeVisible();
});

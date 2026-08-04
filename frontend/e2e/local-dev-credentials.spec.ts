import { test, expect, type Page } from "@playwright/test";

/**
 * Covers specs/features/015-local-dev-generated-credentials — the
 * Donor/Volunteer dummy-login shortcuts are gone; approving an
 * application generates a real per-applicant username instead, and it's
 * both usable to sign in and visible on that person's own dashboard.
 */

const BACKEND = "http://localhost:8001";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test("Sign In modal no longer offers Donor/Volunteer role shortcuts", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("header")
    .getByRole("button", { name: "Sign In", exact: true })
    .click();

  await expect(page.getByText("Local dev only")).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "donor", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "volunteer", exact: true }),
  ).toHaveCount(0);
});

test("approving a volunteer generates a working local-dev login shown on their dashboard", async ({
  page,
}) => {
  const name = `Credential Test Volunteer ${Date.now()}`;
  const expectedUsername = name.toLowerCase().replace(/\s+/g, "_");
  const email = uniqueEmail("local-dev-credentials");

  const seed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "volunteer",
      name,
      email,
      location: "Austin, TX",
      country: "United States",
      packets_per_trip: 20,
      availability: "Weekends",
    },
  });
  expect(seed.ok()).toBeTruthy();

  await page.goto("/");
  await signInAsDummyAdmin(page);
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  const card = page.getByTestId("signup-card").filter({ hasText: email });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card).not.toBeVisible();

  // The header hides Sign Out/Sign In while on #admin — go home first.
  await page.getByRole("button", { name: "← Back to home" }).click();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();

  await page
    .locator("header")
    .getByRole("button", { name: "Sign In", exact: true })
    .click();
  await page.getByLabel("Username").fill(expectedUsername);
  await page.getByLabel("Password").fill("dummy_password");
  await page.getByRole("button", { name: "Dummy Login" }).click();
  await expect(
    page.getByRole("link", { name: "My Volunteering", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "My Volunteering", exact: true })
    .click();
  await expect(page.getByText("Local dev login")).toBeVisible();
  await expect(page.getByText(expectedUsername)).toBeVisible();
  await expect(page.getByText("dummy_password")).toBeVisible();
});

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

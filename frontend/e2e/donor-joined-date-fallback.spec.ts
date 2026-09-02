import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end coverage for
 * specs/features/032-donor-joined-date-fallback — a freshly approved
 * donor with no donations yet shows "Joined <date>" in place of the
 * usual stats: on their homepage "Featured Donors" card (instead of "0
 * meals delivered"), on their public detail page (where the delivery
 * list would otherwise render nothing), and on their own dashboard
 * (appended to the existing "No completed deliveries yet." message).
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

test("a donor with no donations shows a joined date, on both their detail page and dashboard", async ({
  page,
}) => {
  const name = `No Donations Yet Donor ${Date.now()}`;
  const localUsername = name.toLowerCase().replace(/\s+/g, "_");
  const email = uniqueEmail("joined-date-donor");

  const seed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "donor",
      name,
      email,
      location: "Austin, TX",
      country: "United States",
      packet_count: 100,
      delivery_role: "self",
      donor_story: "Testing the joined-date fallback.",
      commit_50k_4yr: true,
      agree_publish_story: true,
    },
  });
  expect(seed.ok()).toBeTruthy();
  const signupId = (await seed.json()).signup_id as string;

  await page.goto("/");
  await signInAsDummyAdmin(page);
  await page.request.post(`${BACKEND}/api/admin/signups/${signupId}/approve`);

  const donors = await page.request.get(`${BACKEND}/api/admin/donors`);
  const donorRow = (
    await donors.json() as Array<{ donor_id: string; email: string }>
  ).find((d) => d.email === email);
  expect(donorRow).toBeDefined();
  const donorId = donorRow!.donor_id;

  // Homepage "Featured Donors" card: 0 meals delivered, so the joined
  // line takes its place instead of the usual meals-delivered stat.
  await page.goto("/");
  const homepageCard = page.locator("button").filter({ hasText: name });
  await expect(homepageCard).toBeVisible();
  await expect(homepageCard.getByText(/^Joined /)).toBeVisible();
  await expect(homepageCard).not.toContainText("meals delivered");

  // Public detail page: the delivery list is empty, so the joined line
  // takes its place.
  await page.goto(`/#donor-${donorId}`);
  await expect(page.getByText("Their Deliveries")).toBeVisible();
  await expect(page.getByText(/^Joined /)).toBeVisible();

  // Sign out of the admin session, sign in as the donor themselves, and
  // check the same thing on their own dashboard.
  await page.goto("/");
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await page
    .locator("header")
    .getByRole("button", { name: "Sign In", exact: true })
    .click();
  await page.getByLabel("Username").fill(localUsername);
  await page.getByLabel("Password").fill("dummy_password");
  await page.getByRole("button", { name: "Dummy Login" }).click();

  await page.getByRole("link", { name: "My Donations", exact: true }).click();
  await page
    .getByRole("button", { name: "Completed Events", exact: true })
    .click();
  await expect(page.getByText(/No completed deliveries yet\. Joined /)).toBeVisible();
});

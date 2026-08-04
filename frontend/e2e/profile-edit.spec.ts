import { test, expect, type Page } from "@playwright/test";

/**
 * Covers specs/features/018-profile-edit and
 * specs/features/024-volunteer-profile-full-fields — a signed-in donor can
 * edit their location/country/donor story from "My Donations", and a
 * signed-in volunteer can edit their location/country/packets-per-trip/
 * availability/volunteering-history/references from "My Volunteering," with
 * both changes persisting across a reload.
 */

const BACKEND = "http://localhost:8001";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function localUsernameFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "_");
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

async function signInAsLocalUser(page: Page, username: string) {
  await page.goto("/");
  await page
    .locator("header")
    .getByRole("button", { name: "Sign In", exact: true })
    .click();
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("dummy_password");
  await page.getByRole("button", { name: "Dummy Login" }).click();
}

test("donor can edit their location, country, and story from My Donations", async ({
  page,
}) => {
  const donorName = `Profile Edit Donor ${Date.now()}`;
  const donorEmail = uniqueEmail("profile-edit-donor");

  const seed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "donor",
      name: donorName,
      email: donorEmail,
      location: "Austin, TX",
      country: "United States",
      packet_count: 60,
      delivery_role: "self",
      donor_story: "Original story.",
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

  await signInAsLocalUser(page, localUsernameFor(donorName));
  await expect(
    page.getByRole("link", { name: "My Donations", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "My Donations", exact: true }).click();
  await page.getByTestId("dashboard-nav-profile").click();
  const profileForm = page.getByTestId("profile-form");
  await profileForm.waitFor();

  await profileForm.getByLabel("Location", { exact: true }).fill("Round Rock, TX");
  await profileForm.getByLabel("Country").selectOption("Canada");
  await profileForm
    .getByLabel("Your Donor Story")
    .fill("Updated donor story.");
  await profileForm.getByRole("button", { name: "Save Profile" }).click();
  await expect(profileForm.getByText("Profile updated.")).toBeVisible();

  // The Profile tab isn't the default — reloading lands back on the
  // overview tab, so it must be reselected before re-checking the form.
  await page.reload();
  await page.getByTestId("dashboard-nav-profile").click();
  await profileForm.waitFor();
  await expect(
    profileForm.getByLabel("Location", { exact: true }),
  ).toHaveValue("Round Rock, TX");
  await expect(
    profileForm.getByLabel("Country"),
  ).toHaveValue("Canada");
  await expect(
    profileForm.getByLabel("Your Donor Story"),
  ).toHaveValue("Updated donor story.");
});

test("volunteer can edit all of their application fields from My Volunteering", async ({
  page,
}) => {
  const volunteerName = `Profile Edit Volunteer ${Date.now()}`;
  const volunteerEmail = uniqueEmail("profile-edit-volunteer");

  const seed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "volunteer",
      name: volunteerName,
      email: volunteerEmail,
      location: "Austin, TX",
      country: "United States",
      packets_per_trip: 20,
      availability: "Weekends",
      volunteering_history: "Helped at last year's food drive.",
      references: "Jane Donor, jane@example.com",
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

  await signInAsLocalUser(page, localUsernameFor(volunteerName));
  await expect(
    page.getByRole("link", { name: "My Volunteering", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "My Volunteering", exact: true })
    .click();
  await page.getByTestId("dashboard-nav-profile").click();
  const profileForm = page.getByTestId("profile-form");
  await profileForm.waitFor();

  // Fields carried over from the original application are prefilled.
  await expect(
    profileForm.getByLabel("Packets You Can Handle Per Trip"),
  ).toHaveValue("20");
  await expect(profileForm.getByLabel("Availability")).toHaveValue("Weekends");
  await expect(
    profileForm.getByLabel("Prior Volunteering Experience"),
  ).toHaveValue("Helped at last year's food drive.");
  await expect(profileForm.getByLabel("Donor References")).toHaveValue(
    "Jane Donor, jane@example.com",
  );

  await profileForm.getByLabel("Location", { exact: true }).fill("Cedar Park, TX");
  await profileForm.getByLabel("Country").selectOption("Mexico");
  await profileForm
    .getByLabel("Packets You Can Handle Per Trip")
    .fill("35");
  await profileForm.getByLabel("Availability").fill("Weekday evenings");
  await profileForm
    .getByLabel("Prior Volunteering Experience")
    .fill("Also helped with the spring drive.");
  await profileForm
    .getByLabel("Donor References")
    .fill("John Donor, john@example.com");
  await profileForm.getByRole("button", { name: "Save Profile" }).click();
  await expect(profileForm.getByText("Profile updated.")).toBeVisible();

  // The Profile tab isn't the default — reloading lands back on the
  // overview tab, so it must be reselected before re-checking the form.
  await page.reload();
  await page.getByTestId("dashboard-nav-profile").click();
  await profileForm.waitFor();
  await expect(
    profileForm.getByLabel("Location", { exact: true }),
  ).toHaveValue("Cedar Park, TX");
  await expect(profileForm.getByLabel("Country")).toHaveValue("Mexico");
  await expect(
    profileForm.getByLabel("Packets You Can Handle Per Trip"),
  ).toHaveValue("35");
  await expect(profileForm.getByLabel("Availability")).toHaveValue(
    "Weekday evenings",
  );
  await expect(
    profileForm.getByLabel("Prior Volunteering Experience"),
  ).toHaveValue("Also helped with the spring drive.");
  await expect(profileForm.getByLabel("Donor References")).toHaveValue(
    "John Donor, john@example.com",
  );
});

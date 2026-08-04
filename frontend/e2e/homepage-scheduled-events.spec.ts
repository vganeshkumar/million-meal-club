import { test, expect, type Page } from "@playwright/test";

/**
 * Covers specs/features/014-homepage-scheduled-events — a donor's
 * scheduled donation event must show up on the public homepage's
 * Scheduled tab, move to Completed once its proof is submitted *and*
 * approved by an admin, and the homepage must pick this up on return
 * visits without a hard reload (the "not refreshing" bug).
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

// Approves a fresh donor application as admin (via the real UI, in the
// same tab) and signs back in as that donor using the generated local
// username — see specs/features/015-local-dev-generated-credentials.
async function approveDonorAndSignIn(
  page: Page,
  name: string,
  localUsername: string,
) {
  const email = uniqueEmail("homepage-events-donor");
  const seed = await page.request.post(`${BACKEND}/api/signups`, {
    data: {
      mode: "donor",
      name,
      email,
      location: "Austin, TX",
      country: "United States",
      packet_count: 100,
      delivery_role: "self",
      donor_story: "Testing the homepage events feed.",
      commit_50k_4yr: true,
      agree_publish_story: true,
    },
  });
  expect(seed.ok()).toBeTruthy();

  await signInAsDummyAdmin(page);
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  const card = page.getByTestId("signup-card").filter({ hasText: email });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card).not.toBeVisible();

  // The header hides its nav (Sign Out/Sign In included) while on
  // #admin — it shows a "back to home" button instead. Go home first.
  await page.getByRole("button", { name: "← Back to home" }).click();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  // Scoped to the header — avoids ambiguity if a "Sign In" prompt is
  // ever added elsewhere on the page.
  await page
    .locator("header")
    .getByRole("button", { name: "Sign In", exact: true })
    .click();
  await page.getByLabel("Username").fill(localUsername);
  await page.getByLabel("Password").fill("dummy_password");
  await page.getByRole("button", { name: "Dummy Login" }).click();
  await expect(
    page.getByRole("link", { name: "My Donations", exact: true }),
  ).toBeVisible();
}

function tinyPngFile(name: string) {
  // A 1x1 transparent PNG, just enough bytes to satisfy the upload flow.
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  };
}

test("a donor's scheduled donation event shows on the homepage and moves to Completed once its proof is approved", async ({
  page,
}) => {
  const uniqueLocation = `Playwright Donation Spot ${Date.now()}`;
  const futureDate = "2030-01-15";
  const donorName = `Homepage Events Donor ${Date.now()}`;
  const localUsername = donorName.toLowerCase().replace(/\s+/g, "_");

  await page.goto("/");
  await approveDonorAndSignIn(page, donorName, localUsername);

  // 1. Schedule the donation event from My Donations > Schedule New
  // Donation Events.
  await page.getByRole("link", { name: "My Donations", exact: true }).click();
  await page.getByTestId("dashboard-nav-schedule").click();
  await expect(
    page.getByRole("heading", { name: "Schedule new donation events" }),
  ).toBeVisible();
  const scheduleForm = page.getByTestId("schedule-donation-form");
  await scheduleForm
    .getByLabel("Exact Address", { exact: true })
    .fill(uniqueLocation);
  await scheduleForm.getByLabel("Date", { exact: true }).fill(futureDate);
  await scheduleForm.getByLabel("Start Time", { exact: true }).fill("09:00");
  await scheduleForm.getByLabel("End Time", { exact: true }).fill("11:00");
  await scheduleForm.getByRole("button", { name: "Schedule Donation" }).click();
  await page.getByTestId("dashboard-nav-scheduled").click();
  await expect(page.getByText(`${futureDate} — ${uniqueLocation}`)).toBeVisible();

  // 2. Back to home — this is a view transition (my-donations -> home),
  // which should trigger a fresh GET /api/content picking up the new
  // donation event.
  await page.getByRole("link", { name: "The Million Meal Club" }).click();
  const scheduledCard = page
    .getByTestId("donation-event-card")
    .filter({ hasText: uniqueLocation });
  await expect(scheduledCard).toBeVisible();
  // No volunteer or partner charity was set, so the card omits delivery
  // detail entirely rather than showing "Unassigned — self-delivered" —
  // see specs/features/023-event-location-time-and-sharing/requirements.md.
  await expect(scheduledCard).not.toContainText("Unassigned");

  // 3. Submit proof for it from My Donations' own "Submit Proof of
  // Delivery" tab, referencing the event — proof submission no longer
  // lives on the (now-retired) homepage Gallery. See
  // specs/features/019-dashboard-profile-tab-and-proof-relocation/design.md.
  await page.getByRole("link", { name: "My Donations", exact: true }).click();
  await page.getByTestId("dashboard-nav-submit-proof").click();
  const submitForm = page.getByTestId("submit-proof-form");
  await submitForm.waitFor();
  await submitForm
    .getByLabel(/Which scheduled donation is this for/)
    .selectOption({ label: `${futureDate} — ${uniqueLocation}` });
  await expect(
    submitForm.getByLabel("Location", { exact: true }),
  ).toHaveValue(uniqueLocation);
  await submitForm.getByLabel("Meals Delivered").fill("50");
  await submitForm
    .getByLabel("Photo Proof")
    .setInputFiles(tinyPngFile("proof.png"));
  await submitForm.getByRole("button", { name: "Submit Proof" }).click();
  // The form unmounts on success (replaced by a "submitted" confirmation
  // card), so this is checked unscoped rather than via `submitForm`.
  await expect(page.getByText("Thanks — submitted for review!")).toBeVisible();

  // 4. The event moves out of Scheduled Events and into Events Pending
  // Approval — it isn't Completed yet, just submitted.
  await page.getByTestId("dashboard-nav-scheduled").click();
  await expect(
    page.getByTestId("my-donation-event-card").filter({ hasText: uniqueLocation }),
  ).toHaveCount(0);
  await page.getByTestId("dashboard-nav-pending-approval").click();
  await expect(
    page
      .getByTestId("pending-approval-event-card")
      .filter({ hasText: uniqueLocation }),
  ).toBeVisible();

  // 5. An admin approves the submission — this is what actually marks the
  // donation event Completed (see specs/features/020).
  await page.request.post(`${BACKEND}/api/auth/logout`);
  await page.goto("/");
  await signInAsDummyAdmin(page);
  const pending = await page.request.get(
    `${BACKEND}/api/admin/submissions?status=pending`,
  );
  const submissions = (await pending.json()) as Array<{
    submission_id: string;
    location: string;
  }>;
  const submission = submissions.find((s) => s.location === uniqueLocation);
  expect(submission).toBeTruthy();
  const approveResp = await page.request.post(
    `${BACKEND}/api/admin/submissions/${submission!.submission_id}/approve`,
  );
  expect(approveResp.ok()).toBeTruthy();

  // 6. Back on the (signed-out) homepage, it now shows under Completed.
  await page.goto("/");
  await expect(
    page.getByTestId("donation-event-card").filter({ hasText: uniqueLocation }),
  ).toHaveCount(0); // not visible under the default Scheduled tab anymore

  await page.getByRole("button", { name: "Completed", exact: true }).click();
  const completedCard = page
    .getByTestId("donation-event-card")
    .filter({ hasText: uniqueLocation });
  await expect(completedCard).toBeVisible();
  await expect(completedCard).toContainText("Delivered");
});

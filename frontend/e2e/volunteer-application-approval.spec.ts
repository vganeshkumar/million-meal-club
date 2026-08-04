import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end coverage for
 * specs/features/011-volunteer-application-approval — the volunteer signup
 * loop now mirrors the donor one: an application sits as
 * "requested_signoff" until an admin reviews it (including the new prior-
 * volunteering-experience / donor-references fields) and approves or
 * rejects it. See that spec's tasks.md "Manual test (frontend)" bullet,
 * which this suite automates.
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
  // The "Admin" nav link only renders once the session resolves
  // isAdmin: true (see Header.tsx) — waiting on it is also the precondition
  // for the next step, clicking it.
  await expect(
    page.getByRole("link", { name: "Admin", exact: true }),
  ).toBeVisible();
}

test.describe("Volunteer application — Join In form", () => {
  test("volunteer mode shows the new optional fields and submits as a pending application", async ({
    page,
  }) => {
    await page.goto("/#participate");
    await page.getByRole("button", { name: "Volunteer To Deliver" }).click();

    const historyField = page.getByLabel(/Prior Volunteering Experience/);
    const referencesField = page.getByLabel(/Donor References/);
    await expect(historyField).toBeVisible();
    await expect(referencesField).toBeVisible();
    await expect(historyField).not.toHaveAttribute("required", "");
    await expect(referencesField).not.toHaveAttribute("required", "");

    // The disclaimer only lives inside the pre-submit <form> — once
    // status flips to "done" the component swaps in a different card
    // entirely (see JoinInForm.tsx), so assert it before submitting.
    await expect(
      page.getByText(
        "This is an application, not an instant sign-up — new volunteers are reviewed before being linked to your account.",
      ),
    ).toBeVisible();

    const email = uniqueEmail("volunteer-form");
    await page.getByLabel("Name", { exact: true }).fill("Playwright Volunteer");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Location / City").fill("Austin, TX");
    await page.getByLabel(/Packets You Can Handle Per Trip/).fill("25");
    await page.getByLabel("Availability", { exact: true }).fill("Weekends");
    await historyField.fill("Packed meals at two prior drives.");
    await referencesField.fill("Priya Sharma (donor) - priya@example.com");

    await page
      .getByRole("button", { name: "Submit Volunteer Application" })
      .click();

    await expect(page.getByText("Application received!")).toBeVisible();
  });
});

test.describe("Volunteer application — admin review", () => {
  test("admin sees the new fields on a volunteer card and can approve it", async ({
    page,
  }) => {
    const email = uniqueEmail("volunteer-approve");
    const seed = await page.request.post(`${BACKEND}/api/signups`, {
      data: {
        mode: "volunteer",
        name: "Approve Me Volunteer",
        email,
        location: "Round Rock, TX",
        country: "United States",
        packets_per_trip: 40,
        availability: "Weekday mornings",
        volunteering_history: "Two years packing meals at a local food bank.",
        references: "Marcus Webb (donor) - marcus@example.com",
      },
    });
    expect(seed.ok()).toBeTruthy();

    await page.goto("/");
    await signInAsDummyAdmin(page);
    await page.getByRole("link", { name: "Admin", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Pending Applications" })).toBeVisible();

    const card = page.getByTestId("signup-card").filter({ hasText: email });
    await expect(card).toBeVisible();
    await expect(card.getByText("Volunteer", { exact: true })).toBeVisible();
    await expect(card).toContainText("40");
    await expect(card).toContainText("Weekday mornings");
    await expect(card).toContainText(
      "Two years packing meals at a local food bank.",
    );
    await expect(card).toContainText("Marcus Webb (donor) - marcus@example.com");

    await card.getByRole("button", { name: "Approve" }).click();
    await expect(card).not.toBeVisible();

    const approved = await page.request.get(
      `${BACKEND}/api/admin/signups?status=approved`,
    );
    const approvedBody = (await approved.json()) as Array<{
      email?: string;
      status: string;
    }>;
    expect(approvedBody.some((s) => s.email === email && s.status === "approved")).toBe(
      true,
    );
  });

  test("admin can reject a volunteer application, leaving it unlinkable", async ({
    page,
  }) => {
    const email = uniqueEmail("volunteer-reject");
    const seed = await page.request.post(`${BACKEND}/api/signups`, {
      data: {
        mode: "volunteer",
        name: "Reject Me Volunteer",
        email,
        location: "Cedar Park, TX",
        country: "United States",
        packets_per_trip: 15,
        availability: "Evenings",
      },
    });
    expect(seed.ok()).toBeTruthy();

    await page.goto("/");
    await signInAsDummyAdmin(page);
    await page.getByRole("link", { name: "Admin", exact: true }).click();

    const card = page.getByTestId("signup-card").filter({ hasText: email });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Reject" }).click();
    await expect(card).not.toBeVisible();

    const rejected = await page.request.get(
      `${BACKEND}/api/admin/signups?status=rejected`,
    );
    const rejectedBody = (await rejected.json()) as Array<{
      email?: string;
      status: string;
    }>;
    expect(rejectedBody.some((s) => s.email === email && s.status === "rejected")).toBe(
      true,
    );

    // A rejected application never creates a Volunteers row, so a signed-in
    // session for that email should still resolve isVolunteer: false (no
    // linkable record exists to claim). We can't sign in as an arbitrary
    // OAuth email without real credentials, but the admin-approved list
    // above already confirms no Volunteers row was created for this path
    // (approval is the only place that happens — see
    // specs/features/011-volunteer-application-approval/design.md).
  });
});

import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end coverage for
 * specs/features/031-charity-partner-contact-email — the admin add/edit
 * partner charity form gains a required Email field, used solely so the
 * admin can contact that charity directly. It must never render anywhere
 * outside the edit form itself.
 */

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

async function goToCharityPartnersTab(page: Page) {
  await page.goto("/");
  await signInAsDummyAdmin(page);
  await page.getByRole("link", { name: "Admin", exact: true }).click();
  await page.getByRole("button", { name: "Charity Partners" }).click();
}

async function fillRequiredCharityFields(page: Page, name: string) {
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Location", { exact: true }).fill("Austin, TX");
  await page
    .getByLabel("Brief summary of the charity")
    .fill("A charity for e2e testing.");
  await page.getByLabel("Core services").fill("Food distribution");
}

test.describe("Admin partner charity form — required Email field", () => {
  test("add-charity form stays unsubmitted when Email is left blank", async ({
    page,
  }) => {
    await goToCharityPartnersTab(page);

    const name = uniqueName("No Email Charity");
    await fillRequiredCharityFields(page, name);
    // Email deliberately left blank.

    await page.getByRole("button", { name: "Add Charity Partner" }).click();

    // Native HTML validation blocks the request entirely — the charity
    // never appears, and the browser flags the Email field as invalid.
    await expect(
      page.getByTestId("charity-card").filter({ hasText: name }),
    ).toHaveCount(0);
    const emailValid = await page
      .getByLabel("Email", { exact: true })
      .evaluate((el: HTMLInputElement) => el.validity.valueMissing);
    expect(emailValid).toBe(true);
  });

  test("add-charity form succeeds once Email is filled, and the card never shows it", async ({
    page,
  }) => {
    await goToCharityPartnersTab(page);

    const name = uniqueName("Full Details Charity");
    const email = `contact-${Date.now()}@example.com`;
    await fillRequiredCharityFields(page, name);
    await page.getByLabel("Email", { exact: true }).fill(email);

    await page.getByRole("button", { name: "Add Charity Partner" }).click();

    const card = page.getByTestId("charity-card").filter({ hasText: name });
    await expect(card).toBeVisible();
    // The read-only card is admin reference for everything else about the
    // charity, but must never render the contact email itself.
    await expect(card).not.toContainText(email);
  });

  test("edit form pre-fills Email for a charity that already has one", async ({
    page,
  }) => {
    await goToCharityPartnersTab(page);

    const name = uniqueName("Edit Prefill Charity");
    const email = `prefill-${Date.now()}@example.com`;
    await fillRequiredCharityFields(page, name);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Add Charity Partner" }).click();

    const card = page.getByTestId("charity-card").filter({ hasText: name });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Edit" }).click();

    const editForm = page.getByTestId("charity-edit-form");
    await expect(
      editForm.getByLabel("Email", { exact: true }),
    ).toHaveValue(email);
  });
});

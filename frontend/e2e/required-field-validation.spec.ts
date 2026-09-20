import { test, expect } from "@playwright/test";

/**
 * Covers specs/features/012-required-field-validation — the Join In
 * submit button must stay disabled until every non-optional field for
 * the current mode is filled, not just reject a click after the fact.
 */

test.describe("Join In form — required-field gating", () => {
  test("donor mode: submit starts disabled and enables only once every required field is set", async ({
    page,
  }) => {
    await page.goto("/#participate");
    const submit = page.getByRole("button", {
      name: "Submit Donor Application",
    });
    await expect(submit).toBeDisabled();

    await page.getByLabel("Name", { exact: true }).fill("Playwright Donor");
    await page.getByLabel("Email", { exact: true }).fill("pw-donor@example.com");
    await page.getByLabel("Location / City").fill("Austin, TX");
    await expect(submit).toBeDisabled();

    await page.getByLabel(/Number of Food Packets/).fill("100");
    await expect(submit).toBeDisabled();

    await page.getByLabel("I'll deliver it myself").check();
    await expect(submit).toBeDisabled();

    await page
      .getByLabel(/Your Donor Story/)
      .fill("Because it matters to my family.");
    await expect(submit).toBeDisabled();

    await page.getByLabel(/I commit to delivering at least 10,000/).check();
    await expect(submit).toBeDisabled();

    await page
      .getByLabel(/I agree to have my story, name, and photos published/)
      .check();
    await expect(submit).toBeEnabled();

    // Unchecking a required checkbox after everything else is filled
    // must re-disable it — this exercises the form's onChange path, not
    // just the [mode, user] effect.
    await page.getByLabel(/I commit to delivering at least 10,000/).uncheck();
    await expect(submit).toBeDisabled();
  });

  test("donor mode: a partner charity satisfies the delivery-role requirement on its own", async ({
    page,
  }) => {
    await page.goto("/#participate");
    const submit = page.getByRole("button", {
      name: "Submit Donor Application",
    });

    await page.getByLabel("Name", { exact: true }).fill("Partner Charity Donor");
    await page
      .getByLabel("Email", { exact: true })
      .fill("pw-partner-donor@example.com");
    await page.getByLabel("Location / City").fill("Austin, TX");
    await page.getByLabel(/Number of Food Packets/).fill("100");
    await page
      .getByLabel(/Your Donor Story/)
      .fill("Because it matters to my family.");
    await page.getByLabel(/I commit to delivering at least 10,000/).check();
    await page
      .getByLabel(/I agree to have my story, name, and photos published/)
      .check();
    // Neither delivery-role radio has been picked yet.
    await expect(submit).toBeDisabled();

    // Picking a partner charity — not a delivery role — is enough on its
    // own; delivery_role and partner_charity are an OR-group, not two
    // independently-required fields.
    await page
      .getByLabel(/Give through a partner charity instead/)
      .selectOption({ index: 1 });
    await expect(submit).toBeEnabled();

    // Clearing it again (back to "— None —") with no delivery role
    // picked either must re-disable the button.
    await page
      .getByLabel(/Give through a partner charity instead/)
      .selectOption({ index: 0 });
    await expect(submit).toBeDisabled();

    // Picking a delivery role instead of a partner charity also works.
    await page.getByLabel("I'll deliver it myself").check();
    await expect(submit).toBeEnabled();
  });

  test("donor mode: delivery role and partner charity are mutually exclusive", async ({
    page,
  }) => {
    await page.goto("/#participate");
    const selfRole = page.getByLabel("I'll deliver it myself");
    const volunteerRole = page.getByLabel(
      "I need a volunteer to collect & deliver",
    );
    const partnerCharity = page.getByLabel(
      /Give through a partner charity instead/,
    );

    // Picking a delivery role, then a partner charity, must clear the
    // radio — only one delivery method applies at a time.
    await selfRole.check();
    await expect(selfRole).toBeChecked();
    await partnerCharity.selectOption({ index: 1 });
    await expect(selfRole).not.toBeChecked();
    await expect(volunteerRole).not.toBeChecked();

    // Picking a delivery role afterward must reset the partner charity
    // select back to "— None, I have my own location —".
    await volunteerRole.check();
    await expect(partnerCharity).toHaveValue("");
    await expect(volunteerRole).toBeChecked();

    // Switching directly between the two radios doesn't touch the
    // (already-empty) partner charity select — no regression there.
    await selfRole.check();
    await expect(volunteerRole).not.toBeChecked();
    await expect(partnerCharity).toHaveValue("");
  });

  test("volunteer mode: submit ignores the two optional fields but requires everything else", async ({
    page,
  }) => {
    await page.goto("/#participate");
    await page.getByRole("button", { name: "Volunteer To Deliver" }).click();
    const submit = page.getByRole("button", {
      name: "Submit Volunteer Application",
    });
    await expect(submit).toBeDisabled();

    await page.getByLabel("Name", { exact: true }).fill("Playwright Volunteer");
    await page
      .getByLabel("Email", { exact: true })
      .fill("pw-volunteer@example.com");
    await page.getByLabel("Location / City").fill("Round Rock, TX");
    await page.getByLabel(/Packets You Can Handle Per Trip/).fill("15");
    await expect(submit).toBeDisabled();

    await page.getByLabel("Availability", { exact: true }).fill("Weekends");
    await expect(submit).toBeEnabled();

    // Prior Volunteering Experience / Donor References are explicitly
    // optional — leaving them empty must never block submission (already
    // true above, since submit is enabled without touching them), and
    // clearing Availability again must re-disable it.
    await page.getByLabel("Availability", { exact: true }).fill("");
    await expect(submit).toBeDisabled();
  });

  test("toggling mode resets which fields gate the button", async ({
    page,
  }) => {
    await page.goto("/#participate");
    await page.getByLabel("Name", { exact: true }).fill("Mode Toggle Tester");
    await page
      .getByLabel("Email", { exact: true })
      .fill("mode-toggle@example.com");
    await page.getByLabel("Location / City").fill("Austin, TX");

    const donorSubmit = page.getByRole("button", {
      name: "Submit Donor Application",
    });
    await expect(donorSubmit).toBeDisabled();

    await page.getByRole("button", { name: "Volunteer To Deliver" }).click();
    const volunteerSubmit = page.getByRole("button", {
      name: "Submit Volunteer Application",
    });
    // Shared fields (name/email/location) carried over, but the
    // volunteer-only required fields are still empty.
    await expect(volunteerSubmit).toBeDisabled();

    await page.getByLabel(/Packets You Can Handle Per Trip/).fill("10");
    await page.getByLabel("Availability", { exact: true }).fill("Evenings");
    await expect(volunteerSubmit).toBeEnabled();
  });
});

# Feature: Charity Partner Tax Refund Eligibility

## Why
Requested by the user (2026-08-29): some partner charities can issue
donors a tax-deductible receipt, some can't, and the admin currently has
no way to record which is which. Donors deciding where to give directly
would want to know.

## Requirements
- The admin add/edit partner charity form gains an optional Yes/No radio
  choice, "Eligible for Tax Refund". Optional means an admin can leave it
  unanswered (neither radio selected) — this is not a required field and
  has no default answer.
- The value is stored per charity and returned by the public content API
  like the other charity fields.
- The `#charities` detail page shows a short "Eligible for Tax Refund"
  indicator on a charity's card when the admin has answered "Yes". When
  unanswered or answered "No", nothing renders — same convention as the
  other optional charity fields (no explicit "Not eligible" messaging).

## Out of scope
- The homepage "Charity Partners" summary cards (`CharityPartnersSection.tsx`)
  — those only ever show name/location/years-active/description, and this
  feature doesn't change that.
- Any tax/legal validation of the claim — this is just an admin-entered
  flag, same trust level as the other free-text charity fields.

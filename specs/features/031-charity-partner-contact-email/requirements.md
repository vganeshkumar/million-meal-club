# Feature: Charity Partner Contact Email

## Why
Requested by the user (2026-09-02): "email is missing for donors,
volunteers and partners" — the admin has no way to reach a partner
charity directly. Since the product is already live, any new field must
not require a backfill: existing charities without an email on file must
keep working exactly as before.

Investigation before implementing turned up that **donors and volunteers
already have this**, end to end, and already meet every requirement
below:
- `DonorAdminView`/`VolunteerAdminView` already carry `email` (optional —
  pre-existing rows simply have `""`), populated from the Join In signup.
- `POST /api/signups` already requires `email` at the router level (422
  if neither the signed-in session nor the form body supplies one) —
  enforced without making it a hard-required Pydantic field, so it stays
  optional in storage.
- `JoinInForm.tsx` already renders Email as an HTML-required field for
  both donor and volunteer mode (omitted only when already signed in,
  since the session's own email is used instead).
- The public `Donor`/`Volunteer` models, and every component that renders
  them (`FeaturedDonors.tsx`, `DonorDetail.tsx`, homepage cards, etc.),
  never carry or render email — it only appears in the admin directory
  (`AdminDirectory.tsx`), for admin reference.

So this feature is scoped to the one real gap: **partner charities have
no email concept anywhere** in the backend or admin UI.

## Requirements
- The admin add/edit partner charity form (`AdminPartnerCharities.tsx`)
  gains a required "Email" field, used solely so the admin can contact
  that charity directly. Required on the form the same way Name/
  Location/Description already are (native HTML `required`, no reactive
  gating needed — this form doesn't use the `JoinInForm`-style
  disabled-until-valid pattern today and this change doesn't introduce
  it).
- The field is **optional in the database** — existing partner charities
  created before this change have no email on file and must continue to
  load, list, edit (re-saving one fills in its email going forward), and
  display exactly as before. No migration/backfill.
- The email is **never returned by, or reachable from, any public
  endpoint** (`GET /api/content`, and by extension every component that
  renders `partnerCharities` from it: `PartnerCharities.tsx`,
  `CharityPartnersSection.tsx`, the homepage). It exists only in the
  admin-only charity endpoints (`GET/POST/PATCH /admin/charities`) for
  the admin's own reference — same visibility rule as donor/volunteer
  email, and enforced the same way: a distinct admin-only response model
  that the public model never carries, not a runtime filter.
- No other page or API response gains an email field as part of this
  change — donor/volunteer already comply (see Why).

## Out of scope
- Letting an already-approved donor/volunteer add or change their email
  after Join In (`PATCH /donors/me` / `PATCH /volunteers/me` have no
  email field today) — a real gap, but not what was asked; noted here so
  it isn't lost.
- Actually sending mail to charities/donors/volunteers from the admin UI
  — this only makes the address available to the admin (e.g. to copy and
  email manually); no mailto link or in-app messaging is added.
- Validating email deliverability beyond basic `type="email"` browser
  validation.

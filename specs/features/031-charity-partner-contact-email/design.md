# Feature: Charity Partner Contact Email — Design

## Backend
- New `PartnerCharityAdminView(CamelModel)` in `domain.py` — every field
  `PartnerCharity` has, plus `email: str | None = None`. A genuinely
  separate Pydantic class from the public `PartnerCharity` (not a
  subclass), same discipline as `DonorAdminView`/`VolunteerAdminView`
  being distinct from the public `Donor`/`Volunteer` — so there is no
  code path where the public `GET /api/content` route could ever return
  email, structurally, not just by convention. (Unlike Donor/Volunteer's
  admin views, this one stays a `CamelModel` — `AdminPartnerCharities.tsx`
  already consumes every other charity field as camelCase, and there's
  no reason to introduce snake_case just for this one field.)
- `CreatePartnerCharityRequest` / `UpdatePartnerCharityRequest` gain
  `email: str | None = None` — optional at the model level (matches
  `tax_refund_eligible`'s precedent); required-ness is a UI-only concern
  enforced by the form's `required` attribute, same split as
  `POST /api/signups`'s router-level check for donor/volunteer email.
- `admin.py`: `list_all_partner_charities`, `create_partner_charity`,
  `update_partner_charity` change `response_model`/return type from
  `PartnerCharity`/`list[PartnerCharity]` to
  `PartnerCharityAdminView`/`list[PartnerCharityAdminView]`. All three
  routes already sit behind `Depends(require_admin)` — no auth change
  needed, only the response shape.
- `Store.create_partner_charity` / `update_partner_charity` /
  `list_all_partner_charities` gain `email: str | None` and return
  `PartnerCharityAdminView` instead of `PartnerCharity`.
- `LocalStore`: threads `email` into the stored charity dict in
  `create_partner_charity`/`update_partner_charity`, same as every other
  optional string field there; `list_all_partner_charities` and both
  create/update methods now build `PartnerCharityAdminView(**charity)`
  instead of `PartnerCharity(**charity)`. `get_content()` is
  **unchanged** — it already builds `PartnerCharity` field-by-field with
  an explicit field list (never spreads the raw dict for a `PartnerCharity`
  return), so it simply never reads or forwards the new `email` key.
- `DynamoStore`: same shape — `create_partner_charity` writes
  `item["email"] = email` only `if email` (truthy check, matching the
  existing convention for optional string fields like
  `core_services`/`website_url`, not the `is not None` convention used
  for `tax_refund_eligible` — a blank string isn't a meaningful email the
  way `False` is a meaningful tax-eligibility answer);
  `list_all_partner_charities`/`update_partner_charity` build
  `PartnerCharityAdminView(..., email=c.get("email"))`. `get_content()`
  is unchanged for the same reason as LocalStore.

## Frontend
- `lib/types.ts`: new `PartnerCharityAdminView` type — same shape as
  `PartnerCharity` plus `email?: string`. `PartnerCharity` itself is
  **not** changed (it's also the type for the public
  `ContentResponse.partnerCharities`, and must not imply email is ever
  present there).
- `lib/api.ts`: `listAllPartnerCharities` return type becomes
  `PartnerCharityAdminView[]`; `createPartnerCharity`/
  `updatePartnerCharity` payload types and return types gain
  `email: string` (required, unlike the other optional fields in those
  payloads) / `PartnerCharityAdminView`.
- `components/AdminPartnerCharities.tsx`:
  - `charities` state, `CharityFields`'s `defaults` prop, and the
    read-only card view's `c` all change from `PartnerCharity` to
    `PartnerCharityAdminView`.
  - `CharityFormFields` gains `email: string`; `readForm` reads it as a
    required plain string (`String(form.get("email") ?? "")`), same
    pattern as `name`/`location`/`description`, not the
    `|| undefined` pattern used for the optional fields.
  - `CharityFields` gains an `Email` field
    (`type="email" name="email" required`), placed right after Location
    — grouped with the other required identity fields, ahead of the
    long-form description/services fields. Labeled plain "Email" (no
    "(optional)" suffix, matching how the other required fields — Name,
    Location, Description, Core services — are labeled without a
    qualifier).
  - The read-only charity card (admin list view) does **not** render
    email — matches the requirement that it exists purely for admin
    reference/contact, not as another visible field; the admin can see
    it by opening Edit, where the form is pre-filled from
    `defaults?.email`.
- No change to `PartnerCharities.tsx` or `CharityPartnersSection.tsx` —
  both already render an explicit whitelist of fields from the public
  `PartnerCharity` type, which never carries email, so there is nothing
  to guard against there.

## Tests
- **Backend** (`backend/tests/test_charity_partner_email.py`, new file):
  - `POST /admin/charities` with an `email` in the body stores it and
    returns it in the `PartnerCharityAdminView` response.
  - `POST /admin/charities` **without** `email` succeeds (optional in
    storage) and returns `email: null`.
  - `GET /admin/charities` includes `email` for a charity created with
    one.
  - `PATCH /admin/charities/{id}` can set an email on a charity that
    didn't have one, and can change an existing one.
  - `GET /api/content` (public, unauthenticated) for a charity that
    *does* have an email on file — assert `"email"` never appears
    anywhere in the response JSON for that charity's entry. This is the
    one that actually enforces the "never public" requirement, not just
    exercises the happy path.
  - `POST /admin/charities` / `GET /admin/charities` without an admin
    session — still 401/403 (unchanged, but worth a smoke assertion
    since the response model changed).
- **Frontend e2e** (`frontend/e2e/admin-partner-charity-email.spec.ts`,
  new file), driving the real admin UI:
  - Add-charity form: submitting without filling Email is blocked by
    native HTML validation (form's `requestSubmit`/native constraint
    validation keeps the browser from firing the request — assert via
    the email input's `validity.valueMissing`, the same technique
    already used implicitly by `required-field-validation.spec.ts`'s
    reliance on native `required`).
  - Add-charity form: filling every required field including Email
    succeeds, and the newly created charity is visible in the admin
    list.
  - Edit form: opening Edit on an existing charity that has an email
    pre-fills the Email input with it.
  - The read-only charity card never renders the email text anywhere in
    its DOM.

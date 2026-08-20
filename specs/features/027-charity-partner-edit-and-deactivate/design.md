# Feature: Charity Partner Edit + Deactivate — Design

## Backend
- `PartnerCharity` gains `status: MembershipStatus = "active"` (the same
  `Literal["active", "disabled"]` alias already used by
  `DonorAdminView`/`VolunteerAdminView`, hoisted above `PartnerCharity`'s
  definition so both can reference it). Unlike `Donor`/`Volunteer`,
  there's no privacy reason to hide `status` from the public model —
  it's exposed on the same `PartnerCharity` CamelModel, not a separate
  AdminView type.
- `get_content()` filters `partner_charities` down to `status == "active"`
  before returning them (same treatment `get_content()` already gives
  disabled donors) — this is what makes deactivation take effect on the
  homepage section, `#charities` page, and Join In / schedule-event
  pickers, since they all source from this same list.
- New `GET /api/admin/charities` (admin-only) — every charity, any
  status, via `store.list_all_partner_charities()`. The admin tab uses
  this instead of the public `GET /api/content` it used before (which
  now hides disabled charities).
- New `PATCH /api/admin/charities/{id}` (admin-only) — takes
  `UpdatePartnerCharityRequest` (same 7 fields as create, all required
  except the four optional ones — full replace, not a patch-in, same
  convention as `update_donation_event`), returns the updated
  `PartnerCharity`.
- New `POST /api/admin/charities/{id}/disable` and
  `POST /api/admin/charities/{id}/reactivate` (admin-only) — same shape
  as the existing donor/volunteer toggle endpoints.
- `Store` protocol gains `list_all_partner_charities`,
  `update_partner_charity`, `set_partner_charity_status` — implemented in
  `LocalStore` (dict mutation in place) and `DynamoStore` (`update_item`
  for both edit and status-toggle, same pattern `set_donor_status` uses).

## Frontend
- `lib/types.ts`: `PartnerCharity` gains `status: "active" | "disabled"`.
- `lib/api.ts`: `listAllPartnerCharities`, `updatePartnerCharity`,
  `disablePartnerCharity`, `reactivatePartnerCharity`.
- `components/AdminPartnerCharities.tsx`: switches its list fetch from
  `api.getContent()` to `api.listAllPartnerCharities()` (now the only way
  to see disabled ones). Each card gets a status badge + toggle button
  (same `StatusBadge`/`ToggleButton` components `AdminDirectory.tsx`
  already defines for donors/volunteers — exported from there for reuse)
  and an "Edit" button that swaps the card into the same field set as the
  create form, pre-filled, with Save/Cancel.
- No change needed to `CharityPartnersSection.tsx`, `PartnerCharities.tsx`,
  `JoinInForm.tsx`, `DonorDashboard.tsx`, or `VolunteerDashboard.tsx` —
  they all already source their charity list from `content.partnerCharities`
  (`GET /api/content`), which now excludes disabled charities for free.

## Data
No schema change beyond the new `status` attribute on
`partner_charities` items (absent = "active", same default-on-read
convention `donors`/`volunteers` already use).

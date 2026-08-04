# Feature: Profile Editing (Donor & Volunteer)

## Why
Requested by the user (2026-08-04): a donor or volunteer today can view their
dashboard (`My Donations` / `My Volunteering`, see
[[../008-persona-dashboards-and-roles/design]]) but has no way to fix a stale
location/country or update their donor story after their application was
approved — those fields are only ever set once, at signup approval time (see
[[../011-volunteer-application-approval/design]]).

## Requirements
- A signed-in donor sees an editable profile section on their dashboard
  (`My Donations`) with their current **location**, **country**, and **donor
  story**, prefilled.
- A signed-in volunteer sees the same kind of editable profile section on
  their dashboard (`My Volunteering`) with their current **location** and
  **country** prefilled. Volunteers have no "story" field in the data model
  (see `Volunteer` in `backend/app/models/domain.py`), so this section does
  not include one.
- Saving updates the donor's/volunteer's record immediately; the dashboard
  reflects the new values without a page reload.
- Only the signed-in donor/volunteer can edit their own profile — there is no
  admin-editing-someone-else's-profile capability here (admins already have
  disable/reactivate in [[../016-admin-membership-status/requirements]];
  editing a member's own fields is a separate concern, out of scope for the
  admin surface here).
- Country uses the same fixed dropdown (`frontend/lib/countries.ts`) as the
  Join In form, for consistency.
- Location and country remain required (non-empty) — story remains required
  for donors (matches the original Join In requirement, see
  [[../012-required-field-validation/requirements]]).

## Out of scope
- Editing name or email (tied to the OAuth identity / signup approval, not
  user-editable here).
- Editing donor/volunteer-specific numeric fields (`packetsPerTrip`,
  `availability`) — availability free text could arguably belong here, but
  wasn't requested; only location/country/(donor) story are in scope for this
  feature.
- Any change to the public donor spotlight display beyond reflecting updated
  story/location — no new public-facing copy or layout.

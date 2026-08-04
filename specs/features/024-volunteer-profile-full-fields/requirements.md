# Feature: Volunteer Profile — Full Application Fields Editable

## Why
Requested by the user (2026-08-04): the volunteer Profile tab (built in
[[../018-profile-edit/design]]) only shows **location** and **country** for
editing, but a volunteer supplies more than that at application time —
`packets_per_trip`, `availability`, prior volunteering experience, and donor
references (see [[../011-volunteer-application-approval/design]]). Of those,
only `packets_per_trip`/`availability` were ever persisted onto the
`Volunteer` record (018 explicitly scoped them out of the edit form);
`volunteering_history`/`references` were never persisted past the original
signup application row at all — they exist only on `SignupAdminView` for the
admin who reviews the application, then are effectively discarded. The user
wants every field they originally entered visible and editable afterward.

## Requirements
- The volunteer Profile section (`My Volunteering` → `Profile`) shows and
  allows editing, prefilled with current values:
  - **Location** (existing)
  - **Country** (existing)
  - **Packets You Can Handle Per Trip** (`packets_per_trip`) — number,
    required, same label/semantics as the Join In form.
  - **Availability** (`availability`) — free text, required, same
    label/placeholder as the Join In form.
  - **Prior Volunteering Experience** (`volunteering_history`) — free text,
    optional.
  - **Donor References** (`references`) — free text, optional.
- Saving persists all six fields immediately; `GET /volunteers/me` reflects
  the update without a page reload (same pattern as the existing
  location/country save).
- `volunteering_history`/`references` must now be persisted onto the
  `Volunteer` record itself at signup-approval time (previously they lived
  only on the transient signup row), so there's something to prefill and
  edit going forward.
- These two fields stay **private** to the volunteer (and admins reviewing
  the original application) — they must NOT be added to the donor-facing
  volunteer directory (`VolunteerSummary` / `GET /volunteers`), same privacy
  boundary the directory already draws around non-public fields.
- Only the signed-in volunteer can edit their own profile — same
  authorization shape as the existing `PATCH /volunteers/me`.

## Out of scope
- Editing name or email (still tied to OAuth identity / signup approval).
- Any change to what admins see during signup review (`SignupAdminView`
  unaffected).
- Backfilling `volunteering_history`/`references` for volunteers already
  approved before this feature ships — their `Volunteer` record simply has
  those fields blank until they fill them in via the new form.

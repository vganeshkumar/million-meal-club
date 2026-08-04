# Feature: Volunteer Application Approval

## Why
[[../008-persona-dashboards-and-roles/requirements]] deliberately gave
volunteers **no** approval gate — a signup immediately created a linkable
`Volunteers` row, unlike a donor application, which sits as
`requested_signoff` until an admin approves it (see
[[../007-donor-application-approval/requirements]]). The founder now wants
the same review discipline for volunteers: before someone is recognized as
a registered volunteer (able to RSVP to events, or submit proof of delivery
on a donor's behalf), an admin should review their application — including
whatever volunteering history and donor references they can offer — and
explicitly approve or reject it. Decided with the user 2026-08-03.

This supersedes the "no approval gate" behavior described in
[[../008-persona-dashboards-and-roles/design]] and the "submitting now
immediately creates an unclaimed Volunteers record" line in
[[../002-join-in-signup/requirements]] — both are now inaccurate for
volunteer mode; treat this spec as the current source of truth for the
volunteer signup → approval loop, mirroring [[../007-donor-application-approval/requirements]]
almost exactly.

## Requirements

### Capture
- Volunteer mode of the Join In form gains two additional, **optional**
  fields, shown alongside the existing Packets Per Trip / Availability /
  Notes fields:
  - **Prior Volunteering Experience** — free text: "Have you volunteered
    with us or elsewhere before? Tell us about it." Optional, since a
    first-time volunteer may have none — the admin weighs whatever's given,
    same as a missing field is itself informative for a first-timer.
  - **Donor References** — free text: name and contact info of any donor(s)
    who can vouch for this volunteer. Optional for the same reason.
- Every volunteer application is now stored with
  `status: "requested_signoff"` (previously: no status at all, and an
  unclaimed `Volunteers` row was created immediately) — identical treatment
  to a donor application.
- Email remains required for volunteer mode (unchanged from
  [[../002-join-in-signup/requirements]] — from the session if signed in,
  otherwise a required form field).

### Admin review page
- The existing `#admin` → "Applications" tab (previously donor-only, see
  [[../007-donor-application-approval/design]]) now lists **both** pending
  donor and volunteer applications — each card is labeled with its mode and
  shows the fields relevant to that mode:
  - Volunteer cards show: name, email, location, country, packets per trip,
    availability, prior volunteering experience, donor references, notes,
    submitted date.
  - Donor cards are unchanged from [[../007-donor-application-approval/requirements]].
- Each has **Approve** and **Reject** actions, same interaction pattern as
  today (optimistic removal from the list on click, no full refetch).

### Approval
- Marks the signup `approved`.
- Creates the volunteer's real, unclaimed `Volunteers` record — using the
  application's name, location, country, email, packets-per-trip, and
  availability — exactly the record that used to be created immediately at
  signup time, just now deferred until an admin signs off.
- Sends an email to the applicant confirming they've been approved as a
  volunteer (mirrors the donor onboarding email — see
  [[../007-donor-application-approval/design]]'s `EmailSender`).

### Rejection
- Marks the signup `rejected`. No email, no `Volunteers` record — same
  shape as donor rejection.

### Claiming — unchanged mechanism, now gated the same way donors are
A volunteer application no longer creates any record until approved, so
`resolve_volunteer_id`'s find-or-claim-or-`None` logic (see
[[../008-persona-dashboards-and-roles/design]]) now naturally only matches
**approved** volunteers — there's nothing to claim before that, exactly
mirroring how `resolve_donor_id` already behaves for donors. No change to
the claiming mechanism itself is needed, only to when the claimable record
starts existing.

### Access control — downstream effect, not new logic
Anything already gated on `resolve_volunteer_id` returning non-`None`
(RSVPing to events, submitting proof on behalf of a donor, `is_volunteer`
on the session) now implicitly requires the application to have been
approved first, since that's the only way a `Volunteers` row comes to
exist. This is a natural consequence of the change above, not a separate
access-control change.

## Out of scope
- Structured/validated reference contacts (e.g. verifying the referenced
  donor actually exists in the system, or contacting them) — both new
  fields are free text the admin reads, same trust model as the donor
  story field.
- A rejection email (matches the donor flow's same omission).
- Any change to how donors are reviewed/approved — this spec only extends
  the existing mechanism to the volunteer signup path.
- Retroactively gating volunteers who were already linked under the old
  "no approval gate" behavior — this is a forward-looking change to the
  signup path only.

# Feature: Country Field for Donor/Volunteer Matching

## Why
Requested by the user (2026-08-03): both donor and volunteer signups only
ever captured a freeform `location` string (e.g. "Austin, TX"). There's no
consistent, structured signal a donor can use to tell which registered
volunteers are actually near them when assigning one to a
[[../009-scheduled-donation-events/requirements|donation event]] — two
volunteers could both write their location differently ("Austin" vs
"Austin, TX" vs "Austin, Texas") with no reliable way to group or sort by.
Adding **country** as a required, selected (not freeform) field on both
signup modes gives a coarse but consistent matching dimension.

## Requirements

### Country field on signup
Both donor and volunteer modes of the Join In form gain a required
**Country** field, selected from a dropdown (not freeform text, so it's a
consistent value to match/sort on) — same treatment as `location`: always
asked (not tied to sign-in state, since a session carries name/email but
not country), stored alongside it.

### Country carried onto the resulting Donor/Volunteer record
- Donor mode: `country` is stored on the `Signups` entry and copied onto
  the `Donors` row at admin-approval time (same treatment as `location`/
  `donor_story`).
- Volunteer mode: `country` is stored directly on the `Volunteers` row at
  signup time (no approval gate, matching everything else about volunteer
  signup).

### Surfaced wherever location already is
`country` is returned alongside `location` on `Donor`, `Volunteer`, and
`VolunteerSummary` (the donor-facing directory used by the donation-event
assignment picker — see
[[../009-scheduled-donation-events/design]]), and shown wherever the
frontend already displays a donor's or volunteer's location (`My
Donations`, `My Volunteering`, the admin donor-application review list).

### Matching signal on the volunteer-assignment picker
`DonorDashboard.tsx`'s "Schedule a donation" volunteer picker and each
scheduled event's reassignment picker now show each volunteer's country
next to their name, and list volunteers **whose country matches the
donor's own country first** (a sort, not a hard filter — the donor can
still pick anyone; this is a nudge toward the likely-right match, not an
enforced restriction).

## Out of scope
- City/state-level structured matching (country is the only new
  structured field — location stays freeform).
- Automatically restricting which volunteers a donor can assign based on
  country (sort-only, per above).
- Backfilling country onto donors/volunteers that existed before this
  change (seed data and dummy-login test personas get an explicit
  default; any already-deployed real data is simply blank until that
  person's next signup/edit — there's no edit-profile flow to backfill
  through today).

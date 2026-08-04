# Feature: Admin Membership Status (Disable/Reactivate Donors & Volunteers)

## Why
Requested by the user (2026-08-04): once a donor or volunteer application is
approved there's no way for the founder to revoke that status later — no way
to remove a bad-actor donor/volunteer from the public site, and no single
admin screen listing every donor, volunteer, and upcoming (scheduled)
donation event to review in the first place.

## Requirements
- An admin, when signed in, can see **all** donors, **all** volunteers (any
  status), and all **upcoming** (scheduled) donation events — a new set of
  tabs in `#admin`, alongside the existing Applications and Submissions
  tabs.
- An admin can **disable** a previously-approved donor or volunteer, and
  **reactivate** one that's currently disabled. This is a simple two-state
  toggle (`active` / `disabled`), not a queue like Applications.
- A disabled donor, and a disabled volunteer, disappear from public-facing
  data: the homepage Featured Donors list, the homepage Events "Scheduled"/
  "Completed" donation-event cards, and the individual donor detail page
  (`/#donor-{id}`, backed by `GET /api/donors/{id}`) for a disabled donor.
  A **donation event** tied to a disabled donor or disabled volunteer is
  also excluded from that same public feed — confirmed with the user: only
  the disabled entities and events involving them disappear, nothing else
  changes about the existing homepage sections.
- A disabled donor or volunteer **cannot sign in**. Confirmed scope: this
  blocks new sign-in attempts (`POST /api/auth/google`, `/facebook`,
  `/dummy`) with a clear error — it does not proactively invalidate an
  already-open browser session.
- Reactivating a donor/volunteer restores both public visibility and
  sign-in ability immediately.

## Out of scope
- Live session revocation (forcing out an already-signed-in disabled user
  before their session naturally expires).
- A third status beyond active/disabled (e.g. a distinct "rejected, never
  active" state) — disable/reactivate is a single toggle regardless of how
  the record got there.
- Any change to the Applications/Submissions review queues themselves.
- Any change to which donors/volunteers a signed-in volunteer/donor can see
  about *themselves* (`GET /api/donors/me`, `/volunteers/me`) — those keep
  working exactly as today for an active member; a disabled member simply
  can no longer sign in to reach them.

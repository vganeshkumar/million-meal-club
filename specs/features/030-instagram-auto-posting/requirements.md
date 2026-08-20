# Feature: Instagram Auto-Posting

## Why
Requested by the user (2026-08-20): they've created an Instagram account
(@millionmealclub — matches the placeholder already linked in the footer,
see [[../../01-architecture]]) and want every donation event automatically
posted there the moment it's scheduled, and again when it's completed —
free promotion piggybacking on activity that's already happening on the
site, with zero manual effort per post.

## Requirements
- **Scheduled**: the moment a donor schedules a donation event
  (`POST /donation-events`, see
  [[../009-scheduled-donation-events/requirements]]), post to Instagram.
  Since there's no photo yet at scheduling time and Instagram requires an
  image on every feed post, this uses one fixed, pre-made branded graphic
  (not photos, not per-event) — the caption carries the event-specific
  detail (donor, location, date).
- **Completed**: the moment an admin approves a submitted proof
  (`POST /admin/submissions/{id}/approve`, see
  [[../004-admin-review-approval/requirements]]), post to Instagram using
  the submission's cover photo — the caption carries meals delivered,
  location, and donor name.
- Fully automatic, no admin review/approval step for the post itself —
  this doesn't touch meal counts or member records, so it isn't covered
  by the constitution's manual-approval rule
  ([[../../00-constitution]] §5), which is specifically about donation
  totals.
- Posting is best-effort: a failure (Instagram API down, token expired,
  rate limited) never blocks or fails the underlying scheduling/approval
  action. Logged, not surfaced to the end user.
- Posting is a no-op (logged, not attempted) until real Instagram API
  credentials are configured — same "not provisioned yet" story already
  used for Google OAuth and the Geoapify map key
  ([[../001-oauth-login/requirements]]).

## Out of scope
- Posting for the older direct-submission flow's completed deliveries
  that were never linked to a scheduled `DonationEvent`... actually
  covered: any approved submission with a cover photo posts, whether or
  not it was linked to a prior scheduled event — no special-casing
  needed since the photo/donor/location data is the same either way.
- Deleting/editing an Instagram post after the fact (e.g. if a submission
  is later rejected/reversed) — not requested.
- Posting to Facebook or any other platform.
- Token refresh automation — long-lived Meta tokens still expire
  (~60 days); refreshing it is a manual operational task for the founder,
  documented in design.md, not code.

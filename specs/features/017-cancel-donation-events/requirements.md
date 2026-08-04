# Feature: Cancel Donation Events

## Why
Requested by the user (2026-08-04): a donor sometimes needs to call off a
donation they scheduled ahead of time (see
[[../009-scheduled-donation-events/requirements]]), and the founder needs
the same ability as a backstop. Once cancelled, the event is noise, not
signal — it shouldn't keep showing on the public homepage feed alongside
genuinely upcoming deliveries.

## Requirements
- A donor can cancel a donation event they scheduled, as long as it's
  still `scheduled` (i.e. proof hasn't been submitted against it yet).
- An admin can cancel **any** donor's scheduled donation event, same
  restriction.
- Cancelling a donation event that already has proof submitted
  (`status == "submitted"`) is rejected — same "locked once final" rule
  `PATCH /donation-events/{id}/volunteer` already enforces for
  reassignment.
- A cancelled donation event no longer appears in the public homepage
  Events feed (`GET /api/content`'s `donationEvents`).
- A cancelled event still appears, marked "Cancelled", in the donor's own
  "My Donations" scheduled-events list and in the admin donation-events
  directory (it just drops out of the *default* "scheduled"/"upcoming"
  admin view, the same way `submitted` events already do).

## Out of scope
- Un-cancelling / restoring a cancelled event.
- Notifying the assigned volunteer that "their" event was cancelled
  (no such notification exists today for any status change).
- Any change to who can *create* or *reassign* a donation event.

# Feature: Edit a Scheduled Donation Event

## Why
Requested by the user (2026-08-04): once a donation event is scheduled
(see [[../009-scheduled-donation-events/requirements]]), the donor or the
volunteer assigned to it currently has no way to fix a mistake or update
the plan — location, date, packet count, delivery method, partner
charity, and notes are all locked in at creation time. The only existing
lifecycle actions are reassigning a volunteer, cancelling
([[../017-cancel-donation-events/requirements]]), and (separately)
submitting proof. This adds the missing "edit and resubmit" action.

Separately, the donor dashboard's "Scheduled Events" list today shows
plan/delivery detail (who's assigned) alongside the event basics, which
crowds a list that should just help a donor find the event they want to
open.

## Requirements
- On the donor dashboard's "Scheduled Events" list, each row shows only
  event information — date, location, and packet count if set. No
  delivery detail (assigned volunteer, delivery role, partner charity,
  notes) is shown in the list itself.
- Clicking a row opens an edit view pre-filled with that event's full
  detail (location, date, packet count, delivery role, partner charity,
  notes, and — donor view only — the assigned-volunteer control and the
  existing Cancel action, both moved here from the list row).
- Saving the edit view updates the event in place (`status` stays
  `scheduled`) — there's no separate approval step for a donation event's
  own detail, only for photo-proof submissions.
- Both the donor who owns the event and the volunteer currently assigned
  to it can open and save this edit view. Nobody else can (same ownership
  model `PATCH .../volunteer` and `POST .../cancel` already enforce, with
  "assigned volunteer" added as a second allowed party).
- The volunteer dashboard gains an analogous "My Assigned Donation
  Events" list (date/location/packet count only, same as the donor's
  list) for events assigned to that volunteer, with the same click-to-edit
  view — minus the assigned-volunteer control and Cancel action, which
  stay donor/admin-only.
- Editing is only available while the event is still `scheduled` — once
  proof has been submitted (`submitted`/`completed`) or it's `cancelled`,
  editing is rejected (same "locked once final" rule reassignment and
  cancellation already enforce).

## Out of scope
- Reassigning the volunteer or cancelling from the volunteer's edit view
  (stays donor/admin-only, unchanged from today).
- Any admin-side edit UI (the admin directory already has its own
  cancel action; editing isn't added there).
- Notifying anyone that an event was edited.

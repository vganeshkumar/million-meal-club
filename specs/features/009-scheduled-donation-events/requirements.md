# Feature: Scheduled Donation Events

## Why
Requested by the user (2026-08-03), immediately after
[[../008-persona-dashboards-and-roles/requirements]] shipped: a donor should
be able to plan a delivery *before* it happens, not just submit proof after
the fact. Specifically:

1. A donor can publish a donation event in advance — pick a **location**
   and **date**.
2. The donor can assign a specific **volunteer** to that event.
3. Once a volunteer is assigned, submitting proof for that event
   auto-populates the counterpart's name: the donor's submit form shows the
   assigned volunteer's name, and the volunteer's submit-for-a-donor form
   shows the donor's name — both read-only, not re-typed.
4. Neither the donor nor the volunteer can submit proof **twice** for the
   same event — once either of them submits, the event is closed to further
   submissions.
5. Location and date are selected when the event is created (not asked
   again at submission time).

## Terminology
Called **"donation event"** (`DonationEvent` in code) throughout, to avoid
confusion with the existing `Events`/`EventItem` entity, which is the
site-wide packing/volunteer-drive calendar (`#events`,
`GET /api/content().events`, RSVP). The two are unrelated: a donation event
is a single donor's planned delivery, created and owned by that donor, not
part of the public community calendar.

## Requirements

### Donor: create a donation event
From "My Donations" (`#my-donations`), a donor can schedule a donation event
by choosing:
- **Location** (required, free text — same as everywhere else in this app).
- **Date** (required — when the delivery is planned).
- **Volunteer** (optional at creation time) — picked from a directory of
  registered volunteers ([[#new-endpoint-list-volunteers]]). Can be left
  unassigned for a self-delivery, and assigned later.

The event starts in status `scheduled`.

### Donor: assign or change the volunteer on an existing event
A donor can assign, change, or clear the volunteer on any of their own
`scheduled` donation events after creating it (not just at creation time).
Once an event is `submitted` (see below), its volunteer assignment is
locked — reassigning after the fact would contradict "this is what actually
happened."

### Donor: view their scheduled donation events
"My Donations" lists the donor's own donation events (both `scheduled` and
`submitted`), showing location, date, assigned volunteer (or "Unassigned"),
and status.

### Submitting proof against a donation event
Both the Gallery submit-proof form (donor, self-service) and the
volunteer's "Submit Proof For A Donor" form gain an optional "which
scheduled donation is this for?" picker, populated from:
- Donor's own `scheduled` donation events (Gallery form).
- Donation events where this volunteer is the assigned volunteer, still
  `scheduled` (volunteer's form).

Selecting one:
- Auto-fills location from the event (donor no longer retypes it).
- Shows the counterpart's name read-only: the volunteer's name (donor
  submitting) or the donor's name (volunteer submitting) — this is what
  requirement 3 means by "autopopulate."
- On submit, the event's donor is used regardless of who submits — so a
  volunteer submitting against an event never needs to know or type a raw
  donor ID (replaces the free-text donor-ID field from
  [[../008-persona-dashboards-and-roles/requirements]] with this picker).

Both forms keep working **without** picking an event too — an unplanned,
spontaneous delivery is still submittable exactly as before: the donor's
form takes a freeform location, and the volunteer's form keeps its
existing free-text donor-ID field as a fallback for delivering on behalf of
a donor who never scheduled an event. The event picker is the *preferred*,
safer path (no need to know/type a raw donor ID, and the counterpart's
name is confirmed automatically) but is additive, not a replacement.

### One submission per donation event
The moment a submission referencing a donation event is created, that
event moves to `submitted` and is removed from both pickers (donor's and
volunteer's) — neither party can submit against it again. If the founder
later **rejects** that submission, the event reopens to `scheduled` so the
donor/volunteer can retry (a rejected submission means "this didn't count,"
not "this delivery didn't happen").

### Access control
- Only the owning donor can create/list/modify their own donation events.
- Only the donor or the currently-assigned volunteer can submit proof
  against a given donation event; anyone else attempting to reference its
  ID gets `403`.
- The volunteer directory endpoint is donor-only (not public, not
  volunteer-facing) — it exists solely to populate the assignment picker.

## Open question / assumption flagged for confirmation
The request says a donor can "pick a volunteer for the event," which reads
as the donor choosing from **known, already-registered** volunteers, not an
open marketplace where any volunteer can self-claim an event. Proceeding on
that basis (a simple directory + picker, no volunteer-side "claim this
open event" flow) since it's the more directly literal reading and the
smaller surface; flagging here rather than guessing silently on something
that changes the access-control model. Easy to extend later if the founder
wants volunteers to browse and claim unassigned events themselves.

## Out of scope
- Removing the volunteer form's existing free-text donor-ID fallback — kept
  as-is (see "Submitting proof against a donation event" above); this spec
  is additive.
- A public/browsable list of unassigned donation events for volunteers to
  self-claim (see "Open question" above).
- Editing an event's location/date after creation (only the volunteer
  assignment is editable pre-submission; get location/date right at
  creation, or cancel — there's no cancel/delete either, out of scope).
- Any admin-facing view of donation events (the founder already reviews
  the resulting submissions exactly as before).

# Feature: Donor Dashboard Lifecycle Navigation

## Why
Requested by the user (2026-08-04), as a follow-up to
[[../019-dashboard-profile-tab-and-proof-relocation/requirements]]. That
feature put everything a donor needs — scheduling, the events list, proof
submission, and delivery history — on a single "overview" tab. As donors
accumulate more events across their lifecycle (scheduled → proof submitted
→ admin-approved, or cancelled), a single scrolling page stops scaling:
there's no way to see "what's still awaiting the founder's review" apart
from "what already counted toward my total."

## Requirements

### 1. Split "My Donations" into lifecycle-stage nav links
The donor dashboard's left-hand nav (added in 019 for Overview/Profile)
gains five links, each swapping in different content in the right-hand
frame, no page reload:
- **Overview** — the donor summary line, local-dev-login box (unchanged
  from before), and the two stat cards (meals delivered, deliveries).
  Becomes its own link rather than living alongside scheduling/proof
  content.
- **Schedule New Donation Events** — just the create-a-donation-event form,
  heading changed from "Scheduled Donation Events" to "Schedule new
  donation events" per the founder's wording. No longer shows the list of
  already-scheduled events inline below it.
- **Scheduled Events** — the list of this donor's donation events that are
  still `status == "scheduled"` (assign/reassign a volunteer, cancel).
  Events that move on to another status (submitted, completed, cancelled)
  drop out of this list rather than staying with a status label.
- **Completed Events** — what was "Delivery history": the donor's approved
  donations (photo, caption, meals, location, date). Renamed, otherwise
  unchanged in substance.
- **Submit Proof of Delivery** — the existing proof-submission form,
  unchanged in substance, just behind its own link instead of always
  visible on the combined overview.
- **Events Pending Approval** — new: donation events with
  `status == "submitted"` (proof submitted, admin hasn't ruled on it yet).
  An event here has no assign/cancel controls — it's locked in review. It
  disappears from this list the moment an admin approves (moves to
  Completed Events) or rejects (moves back to Scheduled Events) the linked
  submission.

Profile keeps its existing link/behavior from 019, unchanged.

### 2. Donation events must reach a real "completed" state
Today a `DonationEvent` linked to an approved submission stays
`status == "submitted"` forever — there's no backend signal that
distinguishes "awaiting review" from "already approved." That's fine for a
single combined list, but "Events Pending Approval" needs to actually empty
out once the founder approves something, per the requirement above. So:
approving a submission that's linked to a donation event now also flips
that event to a new `"completed"` status. Rejecting one still resets it to
`"scheduled"` (unchanged from today).

### 3. The homepage's existing "Completed" tab becomes accurate
The public homepage's Events section already has a Scheduled/Completed
toggle ([[../014-homepage-scheduled-events/requirements]]), but its
"Completed" tab was actually filtering on `status == "submitted"` — i.e. it
labeled "proof submitted, pending review" as "Delivered ✓" to every site
visitor, which was never correct. Once donation events have a real
`"completed"` status (requirement 2), the homepage tab is corrected to
filter on that instead — no change to its layout or the toggle itself.

## Out of scope
- Any change to how admins review/approve/reject submissions
  ([[../004-admin-review-approval/requirements]]) beyond the one new status
  transition in requirement 2.
- A donor-facing view of *rejected* submissions or events reset back to
  Scheduled — that's just a normal Scheduled Events entry again, same as
  before this feature.
- Ad-hoc proof submissions not tied to a scheduled donation event (the
  "None (unplanned)" option on Submit Proof) appearing in Events Pending
  Approval — there's no `DonationEvent` to represent them, and no new
  donor-facing submissions API is being added to backfill that. They still
  count toward Completed Events (the donor's approved-donations list) once
  approved, same as always.
- Volunteer Dashboard ("My Volunteering") — unaffected by this feature.

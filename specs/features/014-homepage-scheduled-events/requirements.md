# Feature: Homepage Scheduled/Completed Events

## Why
Two bugs reported by the user together (2026-08-03):
1. The homepage's public "Upcoming Events" section (`#events`) never
   reflects a donor's own scheduled donation events — because
   [[../009-scheduled-donation-events/requirements]] deliberately kept
   `DonationEvent`s private to the owning donor/assigned volunteer, and
   because `page.tsx` fetches `GET /api/content` once on mount and never
   again, so even content that *did* change wouldn't be seen without a
   full page reload.
2. There's no way to see past ("completed") activity alongside upcoming
   activity in one place.

Decided with the user: `DonationEvent`s become part of the public
homepage feed (a deliberate scope change from
[[../009-scheduled-donation-events/requirements]], which had no public-
visibility story at all — see "Cross-references" below), and the
`#events` section gains a Scheduled/Completed toggle.

## Requirements

### What "Scheduled" and "Completed" mean
- **Scheduled**: the existing community `Events` (admin-curated
  packing/volunteer drives — these have no submission/completion concept,
  so they always count as scheduled) **plus** `DonationEvent`s with
  `status: "scheduled"` (a donor has planned a delivery, proof not yet
  submitted).
- **Completed**: `DonationEvent`s with `status: "submitted"` (proof has
  been submitted for that planned delivery — "completed" here tracks the
  donation event's lifecycle, not the founder's separate admin
  approve/reject step on the submission itself).

### The toggle
- `#events` gains a **Scheduled / Completed** toggle above the event
  grid, defaulting to **Scheduled**.
- If there are no scheduled items at all (no community events and no
  scheduled donation events), the **Scheduled** option is disabled and
  the section shows **Completed** instead.
- Community event cards keep their existing look and "I'll Join This
  One" CTA (unchanged — they're the site's general public join point).
  Donation event cards are new, informational only (donor name, location,
  date, assigned volunteer if any, and — when completed — a "Delivered"
  indicator) — no CTA, since a specific donor's individual delivery isn't
  something a stranger can "join."

### Homepage refresh
`GET /api/content` — which already backs every homepage section — is
re-fetched every time the visitor lands on or returns to the home view
(not just once on first mount), so a donation event scheduled moments ago
(from "My Donations") shows up the next time the homepage is viewed,
without requiring a hard reload.

## Cross-references
[[../009-scheduled-donation-events/requirements]]'s "Out of scope" list
said nothing about public visibility because none was planned; this spec
adds it. Everything else about donation events (creation, volunteer
assignment, one-submission-per-event, access control on the
donor/volunteer-facing endpoints) is unchanged — this is purely a new,
additional public read path.

## Out of scope
- Any interaction on a donation event card from the public homepage (no
  volunteer "claim this" flow — still the explicit out-of-scope call in
  [[../009-scheduled-donation-events/requirements]]'s "Open question").
- Filtering/searching the merged event list.
- Polling or websocket-based live updates — refetch-on-navigate is enough
  for this app's traffic/update frequency; see
  [[../../00-constitution]] "on-demand data."

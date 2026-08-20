# Feature: Homepage Scrollable Top-5 Sections

## Why
Requested by the user (2026-08-20): the homepage's Featured Donors, Events
(Scheduled/Completed), and Charity Partners sections
([[../../01-architecture]]) currently render as wrapping grids with no cap
(donors/partners are soft-capped client-side today) — as each list grows
this gets long and buries the newest/most relevant entries below the
fold. Cap each section to a scannable "top 5" view with the rest reachable
by horizontal scroll, and make sure the top 5 shown are the most relevant
ones by date.

## Requirements
- Featured Donors, Events (whichever tab — Scheduled or Completed — is
  active), and the homepage Charity Partners section
  ([[../026-charity-partner-admin-and-homepage/requirements]]) each
  render as a single horizontally-scrollable row instead of a wrapping
  grid, sized so roughly 5 cards are visible at once on a typical desktop
  viewport, with left/right scroll controls to reach the rest. All
  existing entries still render in the row (nothing is dropped), just
  reachable by scrolling instead of by growing the page's vertical
  height.
- Ordering within each row:
  - **Featured Donors**: unchanged — ranked by total meals delivered
    (highest first), same as today. Only the layout changes (grid →
    scroll row).
  - **Events**: sorted by the event's own date. Scheduled tab: soonest
    upcoming first (ascending) — covers both community drives
    (`EventItem`) and individual scheduled donations (`DonationEvent`),
    interleaved by date. Completed tab: most recently completed first
    (descending).
  - **Charity Partners**: sorted by when the charity was added to the
    system, most recent first. This needs a new `created_at` on
    `PartnerCharity` — the only one of the three entity types with no
    existing date field to sort by.
- The `#charities` full detail page ([[../006-partner-charities/design]])
  and the admin's own charity-partner list are unaffected — this is a
  homepage-section layout/ordering change only.

## Out of scope
- Any change to what counts as "featured" (still all active donors/
  charities, all events) — only presentation (scroll vs. grid) and
  charity ordering change.
- Touch/swipe gesture polish beyond native scroll — native horizontal
  scroll plus click-to-scroll buttons is sufficient.

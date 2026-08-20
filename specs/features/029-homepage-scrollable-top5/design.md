# Feature: Homepage Scrollable Top-5 Sections — Design

## Backend
- `PartnerCharity` gains `created_at: str | None = None` (ISO timestamp,
  same `_now()` convention every other entity already uses). Set on
  `create_partner_charity`, left untouched by `update_partner_charity`.
  Existing charities (created before this field existed) have `None` —
  sorted last, stable-sorted by whatever order the store already returns
  them in (insertion order for `LocalStore`, scan order for
  `DynamoStore`).
- `get_content()` sorts `partner_charities` by `created_at` descending
  (`None` last) before returning them — same "server does the ranking"
  pattern `_ranked_donors` already uses for donors, so the frontend
  doesn't need its own charity-sorting logic.
- No change to `DonationEvent`/`EventItem`/`Donor` — their existing
  `date`/`total_meals` fields are exactly what's needed, per the chosen
  sort keys below.

## Frontend
- New `components/ScrollRow.tsx` — generic horizontal-scroll wrapper
  (used by all three sections instead of duplicating scroll logic):
  props `children`. Renders a `overflow-x-auto` flex row
  (`scroll-snap-type: x proximity`, each child `scroll-snap-align:
  start`) plus two round chevron buttons absolutely positioned at the
  row's left/right edge, each calling `scrollBy({ left: ±cardWidth *
  2, behavior: "smooth" })` on a ref to the scroll container. Buttons
  disable via `scrollLeft`/`scrollWidth` checked on `scroll`/mount
  (no separate state synced via effect beyond that listener). Card
  width is the caller's concern (each section's existing card
  `className` already sets one); `ScrollRow` just stops shrinking
  (`flex-shrink-0` on children via a wrapper) and stops wrapping.
- `components/FeaturedDonors.tsx`: swap the `grid grid-cols-[repeat(...)]`
  wrapper for `<ScrollRow>`; drop `.slice(0, 10)` (show every active
  donor, reachable by scroll); ranking logic (`donors` prop order, already
  sorted server-side by `total_meals`) unchanged.
- `components/Events.tsx`: within whichever tab is active, sort the
  rendered cards by date before mapping — a small `parseEventDate(date:
  string): number` helper (`new Date(date).getTime()`, works for both
  `EventItem`'s `"Aug 16, 2026"` display-string dates and
  `DonationEvent`'s ISO `"2026-09-01"` dates — both are
  `Date`-constructor-parseable). Scheduled tab: `events` and
  `scheduledDonationEvents` are concatenated into one array, sorted
  ascending, then rendered in that interleaved order (so a community
  drive and an individual scheduled donation with nearby dates end up
  next to each other) — swap the existing grid for `<ScrollRow>`.
  Completed tab: `completedDonationEvents` sorted descending, same
  `<ScrollRow>` swap.
- `components/CharityPartnersSection.tsx`: swap grid for `<ScrollRow>`;
  drop `.slice(0, 6)`; ordering already comes pre-sorted from
  `GET /api/content` (see Backend above), so no client-side sort needed.
- `lib/types.ts`: `PartnerCharity` gains `createdAt?: string`.
- No change to `PartnerCharities.tsx` (`#charities` page) or
  `AdminPartnerCharities.tsx` — out of scope per requirements.

## Data
No infra changes — `created_at` is just a new optional attribute on
items already written into the existing `partner_charities` table.

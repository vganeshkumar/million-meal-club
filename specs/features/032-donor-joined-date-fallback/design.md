# Feature: Donor Joined-Date Fallback — Design

## Backend
- `Donor` (`domain.py`) gains `created_at: str | None = None`. `DonorMe`
  inherits it automatically (no change needed there — `GET /donors/me`
  builds `DonorMe(**donor.model_dump(exclude={"donations"}), ...)`, which
  already spreads every `Donor` field).
- `LocalStore.approve_signup` / `DynamoStore.approve_signup`: the donor
  dict/item created on approval gains `"created_at": _now()`, same
  pattern already used for `Users`/`EventRsvps` rows.
- `LocalStore.get_donor` / `DynamoStore.get_donor`: read it back via
  `created_at=d.get("created_at")` (absent → `None`, matching every other
  optional field read from a possibly-older stored record).
- No format conversion anywhere — `created_at` is the same raw ISO string
  `_now()` produces, displayed as-is. Matches the existing convention
  (`AdminSignoff.tsx` already renders `created_at`/`s.created_at` raw,
  unformatted, for signups/applications) rather than introducing a new
  date-formatting utility for this one field.
- `update_donor_profile` in both stores re-reads via `get_donor` after
  writing, so it picks up `created_at` for free — no separate change
  needed there.
- `LocalStore.get_content` / `DynamoStore.get_content`: **the donor list
  build here is a separate code path from `get_donor`** — it constructs
  `Donor(...)` directly from the ranked/scanned donor dicts rather than
  calling `get_donor()`, so `created_at=d.get("created_at")` has to be
  added here too. This is the query the homepage actually uses
  (`GET /api/content`'s `donors` list, consumed by `FeaturedDonors.tsx`)
  — missing it here was the gap in the first pass at this feature.

## Frontend
- `lib/types.ts`: `Donor` gains `createdAt?: string`.
- `components/FeaturedDonors.tsx`: each homepage donor card renders
  `Joined {donor.createdAt}` in place of the
  `{donor.totalMeals} meals delivered` stat when
  `donor.donationCount === 0` **and** `donor.createdAt` is present.
  Unchanged (still shows "0 meals delivered") when either condition
  fails — covers donors approved before this field existed.
- `components/DonorDetail.tsx`: directly above the existing
  `donor.donations.map(...)` block, renders `Joined {donor.createdAt}`
  when `donor.donations` is empty **and** `donor.createdAt` is present.
  Renders nothing (today's behavior, unchanged) when both are
  absent/empty — covers donors approved before this field existed.
- `components/DonorDashboard.tsx`'s `CompletedEventsSection`: the
  existing `"No completed deliveries yet."` empty-state paragraph gets a
  conditional `" Joined {donor.createdAt}."` suffix appended when
  `donor.createdAt` is present; unchanged when absent.

## Tests
- **Backend** (`backend/tests/test_donor_joined_date.py`, new file):
  - Approving a donor signup sets `created_at` on the resulting donor row
    — assert `GET /api/donors/{id}` returns a non-null `createdAt`.
  - `GET /api/content` (the homepage's data source) also includes
    `createdAt` for that donor, alongside `donationCount == 0` — the
    check that would have caught the missed `get_content` code path.
  - `GET /api/donors/me` (signed in as that donor) also returns
    `createdAt` — confirms it survives the `DonorMe` spread.
  - A donor with a logged donation still returns `createdAt` alongside
    their non-empty `donations` list (the field isn't donation-count
    conditional on the backend — the UI decides when to show it).
- **Frontend e2e** (`frontend/e2e/donor-joined-date-fallback.spec.ts`,
  new file), seeding via `page.request.post` + admin approval like the
  other admin-driven e2e specs (e.g.
  `volunteer-application-approval.spec.ts`):
  - A freshly approved donor with no donations: their homepage
    "Featured Donors" card shows "Joined `<date>`" instead of "0 meals
    delivered"; their public detail page shows the same where the
    delivery list would be; their own dashboard's Completed Events
    section shows the joined date appended to "No completed deliveries
    yet."

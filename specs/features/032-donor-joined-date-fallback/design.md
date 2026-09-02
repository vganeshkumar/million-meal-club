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

## Frontend
- `lib/types.ts`: `Donor` gains `createdAt?: string`.
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
  - `GET /api/donors/me` (signed in as that donor) also returns
    `createdAt` — confirms it survives the `DonorMe` spread.
  - A donor with a logged donation still returns `createdAt` alongside
    their non-empty `donations` list (the field isn't donation-count
    conditional on the backend — the UI decides when to show it).
- **Frontend e2e** (`frontend/e2e/donor-joined-date-fallback.spec.ts`,
  new file), seeding via `page.request.post` + admin approval like the
  other admin-driven e2e specs (e.g.
  `volunteer-application-approval.spec.ts`):
  - A freshly approved donor with no donations: their public detail page
    shows "Joined `<date>`" where the delivery list would be; their own
    dashboard's Completed Events section shows the joined date appended
    to "No completed deliveries yet."

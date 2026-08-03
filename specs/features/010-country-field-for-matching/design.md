# Feature: Country Field for Matching — Design

## Data model
No new tables/GSIs — `country: str` is an additive attribute on existing
items:
- `Signups` — `country` alongside `location` (both modes).
- `Donors` — `country`, copied from the signup at approval time.
- `Volunteers` — `country`, set directly at signup time.

## Backend

### `app/models/domain.py`
- `SignupRequest` gains `country: str` (required, same treatment as
  `location` — no mode-specific validator needed since both modes require
  it).
- `Donor`, `Volunteer`, `VolunteerSummary` gain `country: str`.
- `SignupAdminView` gains `country: str` (so the admin applications list
  can show it).

### Store (`store.py` Protocol, `local_store.py`, `dynamo_store.py`)
- `create_signup` — persists `payload.country` on the `Signups` item
  (already flows through automatically via `**payload.model_dump()` in
  both stores' existing implementation); for `mode == "volunteer"`, also
  sets it directly on the new `Volunteers` row (mirrors how `location` is
  already handled there).
- `approve_signup` — `Donor.country` set from `signup.get("country", "")`.
- `get_content`/`get_donor`/`get_volunteer`/`list_volunteers` — read
  `country` off the stored item with a `""` fallback (defensive default
  for any pre-existing row from before this change, per requirements.md
  "Out of scope").
- `provision_dummy_donor`/`provision_dummy_volunteer` — default
  `"United States"` (matches the existing "Austin, TX" default location).
- Local store's seed data (`_seed()`, the three demo donors) — default
  `"United States"`.

## Frontend

### `lib/countries.ts` (new)
A static `COUNTRIES: string[]` list for the `<select>` — "United States"
first (current userbase), then the rest alphabetically.

### `lib/types.ts`
`Donor`, `Volunteer`, `VolunteerSummary` gain `country: string`.
`SignupPayload` gains `country: string` (required, same as `location`).
`SignupAdminView` gains `country: string`.

### `components/JoinInForm.tsx`
A `<select name="country">` (from `COUNTRIES`, defaulting to "United
States") right after the Location field, shown unconditionally (both
modes, regardless of sign-in state — same reasoning as Location: the
session doesn't carry it).

### `components/DonorDashboard.tsx`
- Header line shows `donor.country` alongside `donor.location`.
- `DonationEventsSection`'s volunteer `<select>`s (both the create form
  and each scheduled event's reassignment control) show
  `"<name> — <location>, <country>"` and sort volunteers whose `country`
  matches the donor's own first (`Array.prototype.sort`, stable, not a
  filter — see requirements.md).

### `components/VolunteerDashboard.tsx`
Header line shows `volunteer.country` alongside `volunteer.location`.

### `components/AdminSignoff.tsx`
Pending-applications list shows `country` alongside the existing
`location` field.

## Cross-references
- [[../009-scheduled-donation-events/design]] — the volunteer-assignment
  picker this adds a sort signal to.
- [[../002-join-in-signup/design]] — the signup form this extends.

# Feature: Donor Spotlight & Content — Design

## Backend
- `GET /api/content`'s `donors` array is `Donors` table scan/query results,
  sorted by `total_meals` descending in the handler (small dataset — a
  full-table read is fine at this scale; revisit with a GSI on `total_meals`
  only if the donor list grows very large).
- `GET /api/donors/{donor_id}` — fetches the `Donors` item plus a query on
  `Donations` (PK `donor_id`) filtered to `status == 'approved'`, sorted by
  `date` descending.

## Frontend
- `FeaturedDonors.tsx` — renders `content.donors` (already sorted by the
  backend), top donor gets `accentPalette[1]` (amber), others
  `accentPalette[0]` (green) — same logic as the prototype, now driven by
  real data.
- `DonorDetail.tsx` — fetches `GET /api/donors/{id}` when `view === 'donor'`
  (triggered by hash change / card click, per
  [[../../frontend/design]]'s routing section), renders stat strip + story
  + donations list with the same striped-placeholder photo treatment for
  any donation missing a photo (shouldn't normally happen since photos are
  required at submission, but keep the visual fallback for resilience).

## Data
Already covered in [[../../01-architecture]]: `Donors` (denormalized
aggregate) + `Donations` (per-delivery detail, PK `donor_id`/SK
`donation_id`). The denormalized `total_meals`/`donation_count` on `Donors`
avoid summing `Donations` on every `/api/content` call — they're kept in
sync exclusively by the atomic increments in the approval flow
([[../004-admin-review-approval/design]]), never recomputed from scratch on
read.

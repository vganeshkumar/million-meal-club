# Feature: Donor Spotlight & Content — Tasks

- [x] Backend: `app/routers/content.py` — `GET /api/content` donors sort.
- [x] Backend: `app/routers/donors.py` — `GET /api/donors/{id}` with
      approved-only donations, sorted by date descending.
- [x] Frontend: `FeaturedDonors.tsx` accent-color-by-rank logic.
- [x] Frontend: `DonorDetail.tsx` fetch-on-view + render.
- [x] Manual test: verified via curl against seeded demo donors (3 donors,
      sorted by total meals descending) and confirmed `GET /api/donors/{id}`
      returns correctly sorted donations. `#donor-<id>` hash routing verified
      by code review (useSyncExternalStore) but not yet clicked through in a
      live browser — the Chrome extension wasn't connected this session.

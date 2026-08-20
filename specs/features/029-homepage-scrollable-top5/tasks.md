# Feature: Homepage Scrollable Top-5 Sections — Tasks

- [ ] Backend: `PartnerCharity.created_at`, set on create, sorted
      descending in `get_content()` (both `LocalStore` and
      `DynamoStore`).
- [ ] Frontend: `components/ScrollRow.tsx` (generic horizontal-scroll
      wrapper with left/right buttons).
- [ ] Frontend: `FeaturedDonors.tsx` — swap grid for `ScrollRow`, drop
      the 10-item cap.
- [ ] Frontend: `Events.tsx` — date-sort each tab's cards (ascending for
      Scheduled, descending for Completed), swap grid for `ScrollRow`.
- [ ] Frontend: `CharityPartnersSection.tsx` — swap grid for `ScrollRow`,
      drop the 6-item cap.
- [ ] Frontend: `lib/types.ts` gains `PartnerCharity.createdAt`.
- [ ] Manual test: seed enough donors/events/charities to exceed 5,
      confirm each section shows ~5 up front with working left/right
      scroll buttons reaching the rest, and confirm charity ordering
      reflects most-recently-added-first.

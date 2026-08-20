# Feature: Charity Partner Admin + Homepage Summary — Tasks

- [ ] Backend: `PartnerCharity` model gains `years_active`,
      `awards_credentials`, `website_url`, `donation_url`.
- [ ] Backend: `CreatePartnerCharityRequest` + `POST /api/admin/charities`.
- [ ] Backend: `Store.create_partner_charity` in `LocalStore` and
      `DynamoStore`.
- [ ] Frontend: `lib/types.ts` + `lib/api.ts` updates.
- [ ] Frontend: `components/AdminPartnerCharities.tsx` (create form +
      list), wired into `AdminSignoff.tsx`'s tabs.
- [ ] Frontend: `components/CharityPartnersSection.tsx`, wired into
      `app/page.tsx` home view.
- [ ] Frontend: `components/PartnerCharities.tsx` shows the new fields.
- [ ] Manual test: sign in as admin, add a charity partner with all
      fields filled in, confirm it appears in the admin list, on the
      homepage summary section, and on the `#charities` detail page with
      all fields rendered correctly.

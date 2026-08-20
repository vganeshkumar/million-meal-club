# Feature: Charity Partner Summary Structure — Tasks

- [ ] Backend: `PartnerCharity.core_services` / `.founder_details`,
      threaded through `Create`/`UpdatePartnerCharityRequest`, `Store`
      protocol, `LocalStore`, `DynamoStore`.
- [ ] Frontend: `lib/types.ts` + `lib/api.ts` updates.
- [ ] Frontend: `AdminPartnerCharities.tsx` form gains "Core services"
      (required) and "Founder details (optional)".
- [ ] Frontend: `CharityPartnersSection.tsx` and `PartnerCharities.tsx`
      render the three-paragraph summary, core services highlighted.
- [ ] Manual test: add a charity with all fields, confirm the three
      paragraphs render correctly (core services highlighted) on both the
      homepage section and `#charities`; confirm a charity with no
      founder details just omits that paragraph.

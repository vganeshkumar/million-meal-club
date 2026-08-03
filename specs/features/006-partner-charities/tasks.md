# Feature: Partner Charities — Tasks

- [ ] Backend: `PartnerCharity` model + `partner_charities` field on
      `ContentResponse`.
- [ ] Backend: `PartnerCharities` table in local/dynamo stores, seeded/
      queried in `get_content()`.
- [ ] Infra: `partner_charities` DynamoDB table + `PARTNER_CHARITIES_TABLE`
      env var.
- [ ] Frontend: `components/PartnerCharities.tsx`.
- [ ] Frontend: `Header.tsx` nav link + back-button state for
      `isCharitiesView`.
- [ ] Frontend: `app/page.tsx` hash routing extended to `"charities"`.
- [ ] Frontend: `JoinInForm.tsx` partner-charity select wired to
      `content.partnerCharities`.
- [ ] Manual test: click "Partner Charities" in nav, confirm the page
      renders the seeded list, confirm "Apply As A Donor" returns to the
      Join In section, confirm `#charities` is a working direct link
      (paste URL fresh, refresh page).

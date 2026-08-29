# Feature: Charity Partner Tax Refund Eligibility — Tasks

- [ ] Backend: `PartnerCharity.tax_refund_eligible`, threaded through
      `Create`/`UpdatePartnerCharityRequest`, `Store` protocol,
      `LocalStore`, `DynamoStore`.
- [ ] Frontend: `lib/types.ts` + `lib/api.ts` updates.
- [ ] Frontend: `AdminPartnerCharities.tsx` form gains the Yes/No radio
      group, optional, defaulting to unanswered.
- [ ] Frontend: `PartnerCharities.tsx` renders the indicator when `true`.
- [ ] Manual test: add a charity answering "Yes", confirm the indicator
      renders on `#charities`; leave it unanswered on another charity and
      confirm nothing renders; edit an existing charity to "No" and
      confirm nothing renders and the radio round-trips correctly on
      re-opening the edit form.

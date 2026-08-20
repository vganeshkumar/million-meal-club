# Feature: Charity Partner Edit + Deactivate — Tasks

- [ ] Backend: `PartnerCharity.status`, `get_content()` filters to
      active-only.
- [ ] Backend: `GET /api/admin/charities`, `PATCH
      /api/admin/charities/{id}`, `POST
      /api/admin/charities/{id}/disable`, `POST
      /api/admin/charities/{id}/reactivate`.
- [ ] Backend: `Store.list_all_partner_charities`,
      `update_partner_charity`, `set_partner_charity_status` in
      `LocalStore` and `DynamoStore`.
- [ ] Frontend: `lib/types.ts` + `lib/api.ts` updates.
- [ ] Frontend: `AdminPartnerCharities.tsx` — admin list source switched
      to `listAllPartnerCharities`, status badge + toggle, inline edit.
- [ ] Manual test: edit a charity's fields and confirm they save;
      deactivate a charity and confirm it disappears from the homepage
      section, `#charities` page, and the Join In partner-charity picker,
      but a past donation event/submission that named it still shows
      that name; reactivate it and confirm it reappears everywhere.

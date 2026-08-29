# Feature: Charity Partner Tax Refund Eligibility — Design

## Backend
- `PartnerCharity` gains `tax_refund_eligible: bool | None = None` —
  optional/tri-state (`None` = unanswered, distinct from `False`).
- `CreatePartnerCharityRequest` / `UpdatePartnerCharityRequest` gain the
  same optional field.
- `Store.create_partner_charity` / `update_partner_charity` gain the
  param; `LocalStore`/`DynamoStore` thread it through like the other
  optional fields. `DynamoStore.create_partner_charity` uses
  `is not None` (not truthy) when deciding whether to write the
  attribute, since `False` is a meaningful answer and must not be
  dropped like an absent value.

## Frontend
- `lib/types.ts`: `PartnerCharity` gains `taxRefundEligible?: boolean`.
- `lib/api.ts`: `createPartnerCharity`/`updatePartnerCharity` payload
  types gain `tax_refund_eligible?: boolean`.
- `components/AdminPartnerCharities.tsx`: `CharityFields` gains a
  Yes/No radio group, "Eligible for tax refund? (optional)", placed
  after "Awards / credentials" and before the website/donation links.
  Neither radio is checked when `defaults?.taxRefundEligible` is
  `undefined`; `Yes/No` map to the two radios when it's a boolean.
  `readForm` reads the raw `"yes" | "no" | null` value from FormData and
  converts to `true | false | undefined`.
- `components/PartnerCharities.tsx` (the `#charities` detail page):
  renders a small bold accent-colored "Eligible for Tax Refund" line
  when `c.taxRefundEligible` is `true`. Omitted otherwise (unanswered or
  `false`) — same convention as the other optional fields on this card.
- `components/CharityPartnersSection.tsx` (homepage summary card): same
  small bold accent-colored "Eligible for Tax Refund" line, rendered
  under the description when `c.taxRefundEligible` is `true`. Omitted
  otherwise, same convention.
- No change to the admin's own abbreviated list card — out of scope, see
  requirements.

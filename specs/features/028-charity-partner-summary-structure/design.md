# Feature: Charity Partner Summary Structure — Design

## Backend
- `PartnerCharity` gains `core_services: str | None = None` and
  `founder_details: str | None = None` — optional at the schema level
  (existing charities have neither on file; a required field would break
  `PartnerCharity(**c)` construction for them in both stores).
- `CreatePartnerCharityRequest` / `UpdatePartnerCharityRequest` gain the
  same two optional fields. Requiring `core_services` going forward is
  enforced only in the frontend form (`required` on the input), not the
  API — same "optional wire type, required UI" shape already accepted
  elsewhere isn't otherwise used in this codebase, but is the only way to
  add a new required-ish field without a migration.
- `Store.create_partner_charity` / `update_partner_charity` gain the two
  params; `LocalStore`/`DynamoStore` thread them through the same way the
  other optional fields already are.

## Frontend
- `lib/types.ts`: `PartnerCharity` gains `coreServices?`, `founderDetails?`.
- `lib/api.ts`: `createPartnerCharity`/`updatePartnerCharity` payload
  types gain `core_services?`, `founder_details?`.
- `components/AdminPartnerCharities.tsx`: `CharityFields` gains two
  inputs — "Core services" (`required`, textarea) placed right after
  "Brief summary" (renamed from "Brief description" to match the
  requested wording), and "Founder details (optional)" (textarea) placed
  after "Awards / credentials". `readForm` picks up both.
- `components/CharityPartnersSection.tsx` and
  `components/PartnerCharities.tsx` (the `#charities` detail page): both
  cards render, in order: `description` (plain paragraph, unlabeled, as
  today), then `coreServices` when present — small bold accent-green
  "Core Services" label above a bold accent-green paragraph, matching the
  "Visit Website"/"Donate" link color already used on these same cards —
  then `founderDetails` when present — small bold muted label "Founder"
  above an italic muted paragraph (same treatment `awardsCredentials`
  already gets).
- No change to the admin list's own card in `AdminPartnerCharities.tsx`
  beyond capturing the two new fields in the form — its list view stays
  abbreviated (name/location/description/badges/links), it's not the
  "summary" surface this feature is about.

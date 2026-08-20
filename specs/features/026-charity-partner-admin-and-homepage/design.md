# Feature: Charity Partner Admin + Homepage Summary — Design

## Backend
- `PartnerCharity` (`CamelModel`) gains four new optional fields:
  `years_active: str | None`, `awards_credentials: str | None`,
  `website_url: str | None`, `donation_url: str | None`. Existing
  `id`/`name`/`location`/`description` unchanged.
- New `CreatePartnerCharityRequest` (plain `BaseModel`, snake_case wire
  format — same convention as `CreateDonationEventRequest`): `name`,
  `location`, `description` required; the four new fields optional.
- New endpoint `POST /api/admin/charities` (admin-only, `require_admin`)
  — takes `CreatePartnerCharityRequest`, calls
  `store.create_partner_charity(...)`, returns the created
  `PartnerCharity` (201), same request/response shape as
  `POST /api/donation-events`.
- `Store` protocol gains `create_partner_charity(...) -> PartnerCharity`,
  implemented in both `LocalStore` (in-memory, `uuid4` id, appended to
  `self._partner_charities`) and `DynamoStore` (`PutItem` into the
  existing `partner_charities` table). No infra change needed — the
  Lambda's IAM policy already grants `PutItem`/`UpdateItem` across all
  table ARNs (`infra/modules/api/main.tf`'s `DynamoDbAccess` statement),
  and the `partner_charities` table already exists
  ([[../006-partner-charities/design]] "Data").

## Frontend
- `lib/types.ts`: `PartnerCharity` gains the four new optional fields.
- `lib/api.ts`: new `admin.createPartnerCharity(payload)` call —
  `POST /admin/charities`.
- New `components/AdminPartnerCharities.tsx` (alongside
  `AdminDirectory.tsx`'s other admin-tab components) — a create form
  (all seven fields, required ones marked) plus a read-only list of
  existing charities below it, fetched via the existing public
  `api.getContent()` (partner charities are already public data, so no
  new list endpoint is needed). On successful create, prepend the new
  charity to the local list and clear the form.
- `AdminSignoff.tsx`: add `{ id: "charities", label: "Charity Partners" }`
  to `ADMIN_TABS`, render `<AdminPartnerCharities />` for that tab.
- New `components/CharityPartnersSection.tsx` — homepage section (card
  grid, same shell treatment as `FeaturedDonors`), each card: name,
  location, description (clamped to ~2 lines), years-active badge if
  set, "Visit Website"/"Donate" link buttons (`target="_blank"
  rel="noreferrer"`) if set. Section includes a "See All Partner
  Charities" link to `#charities` (reuses `openCharities` from
  `page.tsx`, same handler the header uses).
- `app/page.tsx`: render `<CharityPartnersSection>` in the home view,
  after `<FeaturedDonors>` and before `<Faq>`, gated on `content` being
  loaded (same treatment as `FeaturedDonors`).
- `components/PartnerCharities.tsx` (the existing `#charities` detail
  page): each card also shows years active, awards/credentials, and
  website/donation links when present.

## Data
No infra changes. The `partner_charities` DynamoDB table and its IAM
grants already exist; this only adds optional attributes to items
written into it.

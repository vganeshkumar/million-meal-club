# Feature: Partner Charities — Design

## Backend
- `PartnerCharity` model: `{ id, name, location, description }`.
- `GET /api/content`'s response gains `partnerCharities: PartnerCharity[]`
  (camelCase on the wire, same `CamelModel` treatment as `donors`/`events`
  — see [[../../backend/design]]).
- Local/Dynamo stores each get a `partner_charities` collection alongside
  `events`/`donors`, read-only from the API's perspective (no
  create/update endpoint yet — founder edits directly, matching the
  `Events` gap noted in [[../../01-architecture]]).

## Frontend
- `components/PartnerCharities.tsx` — new component, rendered when
  `view === 'charities'`. Card grid (`content.partnerCharities`), heading,
  explanatory copy, "Apply As A Donor" CTA (`href="#participate"`, and
  clicking it should also navigate back to `view === 'home'` first — same
  as the design's `goHome` + anchor-scroll pattern).
- `app/page.tsx` routing: extend the `useSyncExternalStore` hash-derived
  `view` to a third state. Parse order: `#donor-<id>` → `"donor"`;
  `#charities` → `"charities"`; anything else → `"home"`.
- `Header.tsx`: add the "Partner Charities" nav link
  (`href="#charities"`), and extend the back-button condition to cover
  both `isDonorView` and the new `isCharitiesView` (both show "← Back to
  ...", donor detail says "all donors", charities says "home" per the
  design).
- `JoinInForm.tsx`'s partner-charity `<select>` is populated from the same
  `content.partnerCharities` passed down from `page.tsx` (no separate
  fetch).

## Data
`PartnerCharities` table: PK `charity_id` (uuid4 or a slug). No GSI needed
— small list, always fetched in full via `GET /api/content`.

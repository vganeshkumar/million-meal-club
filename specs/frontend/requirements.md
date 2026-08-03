# Frontend — Requirements

## Purpose
Recreate `design_artifacts/Million Meal Club.dc.html` (the authoritative
design — see [[01-architecture]] "Source design") pixel-close, as a real
static site, with real data and real auth wired to the backend instead of
hardcoded arrays and simulated sign-in.

## Functional requirements
- All sections/screens in the authoritative design: Header (incl. "Partner
  Charities" nav link), Hero, Progress, Events, How It Works, Join In,
  Gallery, Featured Donors, Partner Charities view, FAQ, Footer, Donor
  Detail view, Sign In modal.
- **Not in the design file, added 2026-08-03**: three persona
  dashboards, none pixel-specced anywhere — styled to match the rest of
  the site's tokens. See [[008-persona-dashboards-and-roles]] for all
  three, which also **fixes a real bug**: the original Admin nav link was
  only shown to users already signed in as admin, making it unreachable
  for anyone else — sign-in (including the local dummy login/role picker)
  now always lives behind the header's always-visible "Sign In" button,
  and each dashboard link (`#admin`, `#my-donations`, `#my-volunteering`)
  only appears once the signed-in session actually has that role.
  - `#admin` — donor-application review (existing) plus a proof-of-
    delivery submissions review tab (existing backend, new screen).
  - `#my-donations` — a donor's own stats/story/delivery history plus a
    way to start a new donation.
  - `#my-volunteering` — a volunteer's profile, event RSVPs, and a
    submit-proof-on-behalf-of-a-donor form.
- **Added 2026-08-03**: a donor can pre-schedule a donation (location,
  date, optional assigned volunteer) from `#my-donations`; both the
  Gallery submit-proof form and the volunteer's submit-for-a-donor form
  gain an optional picker for a scheduled donation, which auto-fills
  location and shows the counterpart's name read-only. See
  [[009-scheduled-donation-events]].
- Content that's currently hardcoded in the prototype but needs a real
  admin-editable backing store (donors, events, partner charities, meal
  totals, milestones, gallery) is fetched at runtime from
  `GET /api/content` — not baked into the static build. See
  [[01-architecture]] for why (donor data is admin-editable post-deploy).
  FAQ copy is the exception: it's already final copy (not placeholder data
  needing a backing store), so it ships as static frontend content — same
  treatment as the "How It Works" steps.
- Real Google + Facebook sign-in (see [[001-oauth-login]]), replacing the
  prototype's `localStorage`-only simulated session.
- Join In form posts to the real backend (see [[002-join-in-signup]]): an
  invitation-only donor application (not instant sign-up) or a volunteer
  registration. Both modes include a required **Country** field (a
  `<select>`, not freeform) alongside Location — carried onto the
  resulting Donor/Volunteer record and shown wherever location already is,
  including as a sort signal on the donation-event volunteer-assignment
  picker. See [[010-country-field-for-matching]].
- Gallery upload form (signed-in only) uploads a real photo via a presigned
  S3 URL and creates a real pending submission (see
  [[003-photo-proof-submission]]). Requires an approved, linked donor as of
  2026-08-03 — a signed-in-but-unapproved user gets a tailored blocked
  message instead of the upload form working (see
  [[007-donor-application-approval]]) — except a linked volunteer, who can
  submit on a chosen donor's behalf instead, from `#my-volunteering` (see
  [[008-persona-dashboards-and-roles]]).
- Donor detail view: hash-routed (`#donor-<id>`), works on direct link/back
  button, matching the design's routing behavior exactly.
- Partner Charities view: hash-routed (`#charities`), same mechanism (see
  [[006-partner-charities]]).
- Meal counter animation, progress bar fill, FAQ accordion, sticky header:
  same interaction behavior as the prototype (see design README's
  "Interactions & Behavior" section) — these are pure client-side UI, no
  backend dependency.

## Non-functional requirements
- Static export only (`output: 'export'`) — no Next.js server runtime in
  production. See [[00-constitution]] §1.
- Pixel-close to the design's colors/type/spacing/copy (OKLCH tokens, fluid
  `clamp()` sizing, Bricolage Grotesque + Karla fonts) — see the design
  README's "Design Tokens" section for exact values.
- Fully responsive with no fixed breakpoints (matches the prototype's
  `auto-fit`/`minmax()`/`clamp()` approach).
- No client-side secrets: the Google OAuth Client ID and Facebook App ID are
  public identifiers (safe to ship in the static bundle); no API keys or
  server secrets ever live in frontend code.
- Session cookie is `HttpOnly` (set by the backend) — the frontend never
  reads/writes the auth token directly, only checks a lightweight
  `/api/auth/me`-style call (or a non-HttpOnly "logged in as X" hint cookie)
  to render signed-in UI state.

## Out of scope (for now)
- Server-side rendering, ISR, or any Next.js feature that static export can't
  support.
- Instagram sign-in (footer link only — see [[01-architecture]]).
- A general CMS UI for the founder to edit content (donors' stories,
  events, partner charities, config) — still happens via the admin API /
  directly in DynamoDB for now (see [[004-admin-review-approval]]). The one
  exception is the donor-application review page (see
  [[007-donor-application-approval]]) — narrowly scoped to that one
  workflow, not a general content editor.

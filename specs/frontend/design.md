# Frontend — Design

## Stack
Next.js 15 (App Router), TypeScript, Tailwind CSS v4, `output: 'export'`.
Tailwind v4 is chosen partly because it supports OKLCH color values natively,
matching the design doc's tokens exactly without hex conversion.

## Structure
```
frontend/
  app/
    layout.tsx        # fonts (next/font/google: Bricolage Grotesque, Karla), global CSS
    page.tsx           # the single page; owns `view`/`donorId` state, hash sync
    globals.css        # Tailwind entry + OKLCH custom properties
  components/
    Header.tsx
    Hero.tsx
    Progress.tsx        # counter + progress bar, IntersectionObserver
    Events.tsx
    HowItWorks.tsx       # static content, no backend dependency
    JoinInForm.tsx       # fund/volunteer toggle
    Gallery.tsx          # gated upload form + public photo grid
    FeaturedDonors.tsx
    DonorDetail.tsx
    PartnerCharities.tsx  # #charities view — see specs/features/006-partner-charities
    Faq.tsx              # static content, no backend dependency (see below)
    Footer.tsx
    SignInModal.tsx
  lib/
    api.ts               # typed fetch wrapper for /api/*, credentials:'include'
    auth.ts              # loads Google Identity Services + FB SDK, exposes signIn()/signOut()
    types.ts             # shared content/domain types mirroring backend pydantic models
  next.config.ts          # output: 'export'
  tailwind.config.ts
```

## State (owned in `app/page.tsx`, passed down as props)
Mirrors the prototype's state model (see design README "State Management"),
now backed by real data:
- `content` — result of `GET /api/content` on mount: `{ config, donors,
  events, partnerCharities, gallery }`. (FAQ copy is not part of this — see
  "Static content" below.)
- `user` — `null` or `{ name, email, provider }`, derived from a lightweight
  `/api/auth/me` call on mount (cookie-based; no localStorage session).
- `view` (`"home" | "donor" | "charities"`) / `donorId` — synced to
  `window.location.hash`, same as prototype plus the new `#charities` route
  (see [[../features/006-partner-charities/design]]).
- `faqOpen`, `joinMode`, `showAuthModal` — pure client UI state, unchanged
  from prototype behavior.

## Data fetching
`GET /api/content` is called once on mount (client-side `useEffect`, not a
server component — there is no server at runtime). No caching layer needed
at this scale; a simple in-memory fetch-once is sufficient. If the founder
just approved something, a page refresh shows it — no rebuild needed.

In `app/page.tsx`, only the sections that genuinely need `content` (Progress,
Events, Join In, Gallery, Featured Donors) are gated behind `content &&`.
Header, Hero, HowItWorks, Faq, and Footer render unconditionally — they must
never disappear just because the fetch is slow or fails, since none of them
actually depend on it. (A previous version of this page nested *all* home
sections behind the same `content &&` check, including the static ones —
that's a bug if it recurs, not a design choice: it means the whole page goes
blank below the header whenever the backend is unreachable, instead of
degrading gracefully to just the sections that actually need data.)

## Static content
`HowItWorks.tsx` and `Faq.tsx` own their copy as hardcoded local constants
(`STEPS` / `FAQS`) — not fetched from `/api/content`, no backend or
DynamoDB table involved. This matches the design handoff: unlike
donors/events/gallery/milestones (empty placeholder data that explicitly
needs a real admin-editable backing store — see [[01-architecture]]'s table
list), the "How It Works" steps and FAQ copy are called out in the design
README as already-final content ("real copy already written"). Editing
either means editing the component file and redeploying, same as any other
static site copy — there is no admin endpoint for these two.

## Auth wiring
- `lib/auth.ts` loads the Google Identity Services script and Facebook SDK
  script on demand (only when the Sign In modal opens, to avoid loading
  third-party scripts on every page view).
- On successful provider sign-in, POST the provider token to
  `/api/auth/google` or `/api/auth/facebook`; backend sets the session
  cookie; frontend re-fetches `/api/auth/me` to update `user` state.
- Sign out: `POST /api/auth/logout` clears the cookie server-side.

## Forms
- Join In (`JoinInForm.tsx`): controlled React form, `POST /api/signups` —
  see [[../features/002-join-in-signup/design]] for the full body shape
  (donor mode is now an invitation-only application: donor story, two
  consent checkboxes, optional partner-charity select — not instant
  "Fund Meals" sign-up). If signed in, `name` is omitted client-side and
  the backend attaches `user_id` from the session.
- Gallery upload (`Gallery.tsx`, signed-in only):
  1. `POST /api/uploads/presign` with `{ content_type, size }` → receives
     `{ upload_url, key }`.
  2. Browser `PUT`s the file directly to `upload_url` (S3 presigned PUT).
  3. `POST /api/submissions` with `{ location, meals, photo_key: key,
     receipt_key?, caption? }`.

## Hash routing (donor detail + partner charities)
Same mechanism as the prototype: clicking a donor card sets `view='donor'`,
`donorId=<id>`, pushes `window.location.hash = 'donor-' + id`; clicking
"Partner Charities" in the nav sets `view='charities'`,
`window.location.hash = 'charities'`. Both scroll to top. The hash is read
via `useSyncExternalStore` rather than mirrored into separate state — the
idiomatic way to read a browser API that changes outside React's render
cycle — and parsed in order: `#donor-<id>` →
`"donor"`, `#charities` → `"charities"`, else → `"home"`. This makes direct
links and back/forward navigation work without a router library, and
avoids Next static-export's dynamic-route build-time limitation (see
[[01-architecture]]).

## Styling tokens
Copied verbatim from the design README's "Design Tokens" section into
Tailwind v4 `@theme` custom properties (OKLCH colors, font stacks, spacing
scale, border-radius scale). Do not approximate with hex — Tailwind v4's CSS
handles OKLCH directly.

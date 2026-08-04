# Feature: Exact Location, Time Range & Social Sharing for Donation Events

## Why
Requested by the user (2026-08-04): scheduling a donation event today
([[../009-scheduled-donation-events/requirements]],
[[../022-edit-scheduled-donation-event/requirements]]) only captures a
free-text `location` string and a `date` — no exact address, no map, no
time. The homepage's scheduled-event card
([[../014-homepage-scheduled-events/requirements]]) shows date, a vague
location string, the donor, and who's delivering, but not notes, not a
partner charity, and nothing visual. There's also no way to share a
specific event to Instagram or another platform — no shareable image,
no link that unfurls a rich preview.

Three build-vs-buy decisions were made explicit with the user before/
during design, since they involve either a billed third-party API or
scope for "shareable":
- **No Google Maps API key exists** (same situation as OAuth credentials
  in [[../001-oauth-login/requirements]] — not provisioned, not free).
  The map is therefore a **static map image**, not an
  interactive/billed Google Map. No photo upload for the location
  itself — the address is the source of truth.
- The first keyless static-map service tried (`staticmap.openstreetmap.de`)
  turned out to be dead (DNS doesn't resolve, confirmed against public
  resolvers) once implementation reached it, and every other still-live
  keyless option either 403s or is a foreign (Yandex) dependency with no
  ToS guarantee. Re-surfaced to the user mid-build: the map now renders
  via **Geoapify's free-tier Static Maps API**, which needs an API key —
  same "not provisioned yet, degrade gracefully" situation as Google/
  Facebook OAuth (see `frontend/lib/auth.ts`'s "not configured" pattern).
  Until `GEOAPIFY_API_KEY` / `NEXT_PUBLIC_GEOAPIFY_API_KEY` are set, the
  map image is simply omitted everywhere it'd appear — the address-only
  fallback described below.
- "Easy to share" means **both** (a) a downloadable/native-share-sheet
  branded image card (works for Instagram, which has no link-paste
  concept) and (b) a rich link preview (Open Graph tags) plus one-click
  share buttons for link-based platforms (X, Facebook, WhatsApp).

## Requirements
- Scheduling a donation event (create, and edit while still `scheduled`)
  requires an **exact address** (the existing `location` field, now
  documented/labeled as such) and a **time range** — a required start
  time and end time, validated end > start.
- The scheduling form and the edit/view panel for an existing scheduled
  event (`EditDonationEventModal` — opened both from the donor's
  "Scheduled Events" list and the volunteer's "My Assigned Donation
  Events" list) show a **live map preview in that same panel**: as an
  address is typed (debounced) or already stored on the event being
  viewed, a static map image renders inline, client-side-geocoded so it
  doesn't require saving first. Falls back to showing nothing (not a
  broken image or placeholder) when the address doesn't resolve or no
  Geoapify key is configured.
- On save, the backend geocodes the address (via Geoapify's Geocoding
  API — see "Map provider" in design.md for why not the originally-planned
  keyless Nominatim) and stores latitude/longitude on the event. Geocoding
  failure (address not found, service unavailable, no key configured)
  does **not** block scheduling — the event saves with coordinates left
  unset, and the homepage simply omits the map for that event.
- The homepage's scheduled donation-event card
  ([[../014-homepage-scheduled-events/requirements]]) displays, when
  present: a static map image (linking out to Google Maps directions) —
  shown only when both coordinates exist *and* a Geoapify key is
  configured — or, otherwise, the plain address (also linking to
  directions when coordinates exist); the formatted time range next to
  the date; the notes text; and — mutually exclusive, as already modeled
  — the assigned volunteer's name or the partner charity name, shown
  **only when one of those is actually set**. When neither a volunteer
  nor a partner charity is assigned (including plain self-delivery), no
  delivery-detail line is shown at all — no "Unassigned" / "self-delivered"
  filler text. This applies to scheduled events only; the completed-event
  card and modal ([[../021-completed-event-details/requirements]]) are
  unchanged and keep their existing "Unassigned — self-delivered" text.
- Each scheduled event card on the homepage gets a "Share" control that:
  - Generates a branded, on-theme image (event date, time range, address,
    notes excerpt, partner/volunteer line, packet goal if set) client-side
    and offers it via the native share sheet (`navigator.share` with a
    file, where supported) or a direct download, so it can be posted to
    Instagram/Stories or any app that accepts an image.
  - Offers a copyable link plus one-click share buttons for X, Facebook,
    and WhatsApp. That link points at a new public, unauthenticated
    backend page that serves Open Graph meta tags (title, description,
    and an image — the static map, when available) so the link unfurls
    with a rich preview when pasted into those apps, then redirects a
    human visitor back to the site's Events section.
- Both the create form (`ScheduleDonationSection`) and the edit modal
  (`EditDonationEventModal`) gain start/end time inputs alongside the
  existing date input.

## Out of scope
- Interactive/embedded Google (or any billed) map — revisit only if the
  founder provisions a Maps API key, same conditional as OAuth.
- Uploading a photo of the location itself (distinct from the existing
  post-delivery proof photo on completed events, which is untouched).
- Deep-linking a share/OG link to a specific event within the SPA (the
  human-facing redirect target is the Events section, not a per-event
  scroll/highlight) — the static-exported frontend can't bake per-event
  routes at build time for events created after export, and adding
  server-rendered per-event pages would contradict the static-first
  constitution guardrail.
- Sharing for completed events (their own display/modal already exists
  and isn't part of this request).
- Any change to the community `EventItem` type (non-donation events) —
  this feature is scoped to `DonationEvent` only.

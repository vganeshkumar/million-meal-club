# Feature: Exact Location, Time Range & Social Sharing — Design

## Backend

### `app/models/domain.py`
`DonationEvent` gains four fields (all optional on the response — existing
rows without them just read back `None`):
```python
class DonationEvent(CamelModel):
    ...
    location: str  # exact address going forward; free text historically
    latitude: float | None = None
    longitude: float | None = None
    start_time: str | None = None  # "HH:MM", 24h
    end_time: str | None = None  # "HH:MM", 24h
```
`CreateDonationEventRequest` and `UpdateDonationEventRequest` both add
required `start_time: str` / `end_time: str` (mirroring how `date` is
already required). No `latitude`/`longitude` on the request models —
those are derived server-side, never client-supplied.

### `app/services/geocode.py` (new)
```python
def geocode(address: str) -> tuple[float, float] | None:
    """Best-effort geocode via Geoapify's Geocoding API. Returns None on
    any failure (not found, timeout, non-200, or GEOAPIFY_API_KEY unset)
    rather than raising — geocoding is enrichment, never a blocker for
    scheduling an event."""
```
Implementation: a single `requests.get` to
`https://api.geoapify.com/v1/geocode/search` with `params={"text":
address, "limit": 1, "apiKey": GEOAPIFY_API_KEY}` and a short timeout
(e.g. 5s), wrapped in `try/except`. Parses `lat`/`lon` off
`features[0].properties` if present. No-ops immediately (no network
call) when `GEOAPIFY_API_KEY` is unset.

**Provider history**: this originally called OpenStreetMap's free,
keyless Nominatim service. Once a Geoapify key existed (provisioned for
the map image — see "Map provider" below), live testing surfaced a real
gap: Nominatim's structured-query parser returned zero results for
addresses with landmark-relative phrasing or more than two
comma-separated components — e.g. `"siddhi vinayak temple, S.K. Bole
Marg, Prabhadevi, Mumbai 400028, Maharashtra, opposite Hotel
Kohinoor"`, an address a user actually typed, and even the simplified
`"Siddhivinayak Temple, Prabhadevi, Mumbai"` — despite the place being
well-mapped in OSM's own data under a bare `"Siddhivinayak Temple,
Mumbai"` query. This is common with Indian addressing conventions
("opposite X", multi-component locality chains). Geoapify's geocoder
resolved both correctly in live testing, so geocoding moved to it —
consolidating to one provider/one key instead of two independent free
services with different reliability profiles.

### `app/routers/donation_events.py`
Both `create_donation_event` and `update_donation_event` validate
`end_time > start_time` (plain string comparison is valid for `HH:MM`
24h zero-padded values), returning `400` if not, then call
`geocode(body.location)` and pass the resulting `latitude`/`longitude`
(possibly both `None`) through to the store call alongside
`start_time`/`end_time`. This mirrors the existing pattern where the
router resolves `volunteer_name` before handing plain data to the store.

New public route, no `Depends(get_current_user)`:
```
GET /donation-events/{event_id}/share -> text/html
```
- 404 if the event doesn't exist or its status isn't `scheduled` (matches
  this feature's scope — see "Out of scope").
- Renders a minimal HTML document (an f-string template, no new
  templating dependency needed for one small page) with:
  - `<title>` / `og:title`: `"{donor_name} is delivering meals on {date}"`
  - `og:description`: time range + address, with notes appended if
    present.
  - `og:image`: the static-map URL (see Frontend below — same URL
    formula, built server-side here) only if `latitude`/`longitude` are
    set **and** `GEOAPIFY_API_KEY` is non-empty; omitted entirely
    otherwise (no fallback logo asset exists today, and inventing
    on-brand artwork is a design task, not this feature's scope).
  - `<meta http-equiv="refresh" content="0; url={SITE_BASE_URL}/#events">`
    plus a plain `<a>` fallback link, so a human who clicks the shared
    link lands on the real site while crawlers (which don't execute the
    refresh) still see the OG tags.
- `SITE_BASE_URL` — new env var (see Infra below), defaulting to
  `http://localhost:3000` for local dev.
- `GEOAPIFY_API_KEY` — new env var (see Infra below), defaulting to `""`
  (not provisioned). See "Map provider" below for why Geoapify.

### Map provider
`_static_map_url(latitude, longitude)` in `app/routers/donation_events.py`
(mirrored by `lib/staticMap.ts::staticMapUrl` on the frontend) builds a
[Geoapify Static Maps API](https://apidocs.geoapify.com/docs/static-maps/)
URL:
```
https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=600&height=300&center=lonlat:{lon},{lat}&zoom=16&marker=lonlat:{lon},{lat};color:%23d97b29;size:large&apiKey={GEOAPIFY_API_KEY}
```
This replaced an original plan to use a keyless static-map mirror
(`staticmap.openstreetmap.de`), which turned out to be dead (DNS doesn't
resolve — confirmed against public resolvers, not a sandbox artifact) once
implementation reached it. The remaining still-live keyless option
(Yandex's static maps API) was rejected as a foreign, ToS-uncertain
dependency for a US charity's public page; every Western alternative
(MapQuest, MapTiler, Wikimedia's snapshot service) now requires a key or
403s. Geoapify's free tier needs `GEOAPIFY_API_KEY` (backend) /
`NEXT_PUBLIC_GEOAPIFY_API_KEY` (frontend) — not provisioned yet, same
"degrade to no map, no error" situation as Google/Facebook OAuth
credentials (`frontend/lib/auth.ts`'s pattern). `lib/staticMap.ts`
exports `hasStaticMap()` (`NEXT_PUBLIC_GEOAPIFY_API_KEY !== ""`) that
every map-rendering call site checks before attempting the image.

### `Store` protocol / `local_store.py` / `dynamo_store.py`
`create_donation_event` and `update_donation_event` gain
`latitude: float | None`, `longitude: float | None`, `start_time: str`,
`end_time: str` parameters. `local_store.py` sets them directly on the
row dict; `dynamo_store.py` follows the existing "only write attributes
that have a value" convention for the nullable `latitude`/`longitude`
(SET when not `None`, otherwise omit on create / `REMOVE` on update,
same shape `packet_count`/`delivery_role`/etc. already use) and always
writes `start_time`/`end_time` since they're required. Both
`_donation_event_from_row`/`_donation_event_from_item` read the four new
fields with `.get(...)`.

## Infra

### `infra/modules/api/main.tf`
New Lambda env var:
```hcl
SITE_BASE_URL = var.site_base_url
```
### `infra/modules/api/variables.tf`
```hcl
variable "site_base_url" {
  type        = string
  description = "Public origin of the frontend, used to build the redirect target on the donation-event share page."
}
```
Also a `geoapify_api_key` variable (`sensitive = true`, default `""`),
conditionally included in the Lambda env the same way
(`var.geoapify_api_key != "" ? { GEOAPIFY_API_KEY = var.geoapify_api_key } : {}`).

### env root (wherever `module "api"` is instantiated, e.g. `infra/envs/*/main.tf`)
Pass `site_base_url = local.has_custom_domain ? "https://${var.domain_name}" : ""` — known upfront from `var.domain_name`, deliberately not sourced from `module.static_site` (which itself depends on `module.api.api_domain_name` — referencing it back would be a cycle). Empty when no custom domain exists; frontend and API are same-origin in production per `specs/01-architecture.md`, so this is otherwise just the site's own domain. Also pass through a root-level `geoapify_api_key` variable (same `sensitive`/default-empty shape) to `module "api"`.

## Frontend

### `lib/types.ts`
```ts
export type DonationEvent = {
  ...
  latitude?: number;
  longitude?: number;
  startTime?: string; // "HH:MM"
  endTime?: string;
};
```

### `lib/api.ts`
`createDonationEvent` / `updateDonationEvent` payload types add required
`start_time: string; end_time: string`.

### `lib/staticMap.ts` (new, shared)
```ts
const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? "";

export function hasStaticMap(): boolean {
  return GEOAPIFY_API_KEY !== "";
}

export function staticMapUrl(lat: number, lon: number): string {
  return `https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=600&height=300&center=lonlat:${lon},${lat}&zoom=16&marker=lonlat:${lon},${lat};color:%23d97b29;size:large&apiKey=${GEOAPIFY_API_KEY}`;
}

export function directionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

export function formatTimeRange(start?: string, end?: string): string | null {
  // "14:00"/"16:30" -> "2:00 PM – 4:30 PM"; null if either is missing.
}

// Client-side-only geocode for the live form preview (below) — the
// backend geocodes independently on save via its own GEOAPIFY_API_KEY.
export async function geocodePreview(address: string): Promise<{ lat: number; lon: number } | null> {
  // fetch() straight to Geoapify's geocode/search endpoint using the
  // same public NEXT_PUBLIC_GEOAPIFY_API_KEY; returns null on any
  // failure or when hasStaticMap() is false.
}
```
`staticMapUrl`/`hasStaticMap` are used by both `Events.tsx` (homepage
card) and by the backend design above for the equivalent URL formula
(kept in sync by convention, same as other small duplicated formatting
rules already living independently on each side of this codebase).
`formatTimeRange` is also used by `lib/shareCard.ts` (below).
`geocodePreview` is used by `components/AddressMapPreview.tsx` (below).

### `components/AddressMapPreview.tsx` (new, shared)
```tsx
export function AddressMapPreview({
  address,
  initialLat,
  initialLon,
}: {
  address: string;
  initialLat?: number | null;
  initialLon?: number | null;
}): JSX.Element | null
```
Renders a static map image inline (600×300 aspect, no directions link —
that's the homepage card's job) whenever coordinates are known for the
current `address` value. Seeds state from `initialLat`/`initialLon` when
given (so `EditDonationEventModal` shows the event's already-stored map
immediately on open, no network round trip), then debounces (600ms) a
`geocodePreview` call whenever `address` changes away from whatever
string the current coordinates were resolved for — including retrying on
mount for a pre-filled address that was never successfully geocoded at
scheduling time. Renders `null` (no placeholder, no border box) when
`hasStaticMap()` is false, the address is blank, or nothing has resolved
yet. Used by both `ScheduleDonationSection` and `EditDonationEventModal`.

### `components/DonorDashboard.tsx` (`ScheduleDonationSection`)
Adds `addressInput` state (the location `<input>` gains an `onChange`
alongside its existing uncontrolled/`FormData`-read pattern — the input
itself stays uncontrolled, this state is purely for the preview) and
renders `<AddressMapPreview address={addressInput} />` directly under the
address/date row. Reset to `""` alongside the rest of the form on
successful submit.

### `components/EditDonationEventModal.tsx`
Same pattern: `addressInput` state initialized from `event.location`, the
location `<input>` gains the matching `onChange`, and
`<AddressMapPreview address={addressInput} initialLat={event.latitude} initialLon={event.longitude} />`
renders under the address/date row — this is the "view a scheduled
event" surface, opened from both the donor's "Scheduled Events" list and
the volunteer's "My Assigned Donation Events" list.

### `lib/shareCard.ts` (new)
```ts
export async function generateEventShareImage(
  event: DonationEvent,
  theme: { accentGreen: string; accentAmber: string },
): Promise<Blob>
```
Draws a 1080×1080 canvas client-side: brand gradient background using the
passed-in accent colors (falls back to hardcoded hex if a value is empty
or the browser can't parse it), wordmark, date + formatted time range,
address, a wrapped notes excerpt, the partner/volunteer line (omitted
entirely — no line drawn, not even blank — when neither is set, matching
`Events.tsx` below), and packet count/goal if set, plus a simple drawn
pin glyph (canvas paths — no new
image asset or npm dependency). No external image (map or otherwise) is
drawn into the canvas, deliberately: fetching the static-map image into a
`<canvas>` and then exporting it (`toBlob`/`toDataURL`) would taint the
canvas unless the third-party host sends permissive CORS headers, which
isn't guaranteed — text/brand-only keeps this reliable regardless of map
provider. Resolves to a `Blob` (`image/png`). The caller (`ShareEventMenu`
below) resolves the theme colors via `getComputedStyle` on its own DOM
node rather than `document.documentElement`, since `--accent-green`/
`--accent-amber` are set as inline style props on a wrapper `<div>` in
`app/page.tsx` (from `content.config.accentPalette`), not on the root
element — any descendant node inherits them, which a card/menu element
always is.

### `components/ShareEventMenu.tsx` (new)
Small popover, opened by a "Share" button on each scheduled
`DonationEventCard`:
- Primary action: if `navigator.canShare?.({ files: [...] })`, calls
  `navigator.share({ files: [pngFile], title, text, url: shareUrl })`
  (generates the image lazily on click, not eagerly for every card, to
  avoid needless canvas work). Falls back to a "Download Image" `<a
  download>` built from the same blob when Web Share (or the files
  variant of it) isn't supported.
- "Copy Link" button copying `shareUrl` (see below) to the clipboard.
- Direct intent links for X (`https://twitter.com/intent/tweet?...`),
  Facebook (`https://www.facebook.com/sharer/sharer.php?u=...`), and
  WhatsApp (`https://wa.me/?text=...`), all opening in a new tab.
- `shareUrl = `${NEXT_PUBLIC_API_BASE_URL}/donation-events/${event.id}/share`` — the backend OG page from above, not a raw frontend link, since that's the one that unfurls correctly when pasted.

### `components/Events.tsx`
Split into two components — `CompletedDonationEventCard` (unchanged
behavior, just renamed/de-branched) and `ScheduledDonationEventCard`
(new) — rather than one component branching on a `completed` prop,
since the new one needs its own `useState` (`mapFailed`) and
conditionally-called hooks aren't allowed. `CompletedEventModal` is
unchanged.

`ScheduledDonationEventCard`:
- Replaces the (currently proof-photo-only) image slot with the static
  map image (`staticMapUrl(event.latitude, event.longitude)`) when
  coordinates are present **and** `hasStaticMap()` is true, wrapped in an
  `<a href={directionsUrl(...)} target="_blank">`; falls back to plain
  address text (linked to directions when coordinates exist, plain
  otherwise) when either condition fails. `onError` on the `<img>` also
  falls back to plain text, in case Geoapify is unreachable.
- Date badge gains the formatted time range:
  `{event.date} · {formatTimeRange(event.startTime, event.endTime)}`.
- Adds the notes paragraph (if `event.notes`) and a delivery-detail line
  — `partner_charity` when set, else the volunteer's name when assigned
  (mutually exclusive, same as the scheduling form already enforces) —
  **rendered only when one of those two is actually present**. When
  neither is set (unassigned/self-delivered), no line renders at all;
  the previous `"Unassigned — self-delivered"` filler text is gone for
  scheduled events specifically (`CompletedDonationEventCard` keeps it
  unchanged).
- Renders `<ShareEventMenu event={event} />`.

### `components/DonorDashboard.tsx` (`ScheduleDonationSection`)
Adds required start/end `<input type="time">` fields next to the date
input, included in the `FormData` read in `handleCreate` and passed to
`api.createDonationEvent`.

### `components/EditDonationEventModal.tsx`
Same two `<input type="time">` fields, pre-filled from
`event.startTime`/`event.endTime`, included in `handleSubmit`'s payload.

## Manual verification
- With `GEOAPIFY_API_KEY`/`NEXT_PUBLIC_GEOAPIFY_API_KEY` set: schedule a
  donation event with a real, geocodable address and a time range where
  end > start; confirm it saves and the homepage card shows a map image
  linking to Google Maps directions, the formatted time range, notes,
  and (with/without a volunteer or partner charity set) the correct one
  of those two lines.
- Without a Geoapify key configured (the default until provisioned):
  confirm the homepage card still shows the address (linked to
  directions when coordinates resolved), time range, and notes — just no
  map image — and that the `/share` page still returns 200 with
  og:title/og:description but no og:image.
- Schedule one with a nonsense/non-geocodable address; confirm it still
  saves (no error) and the homepage card falls back to plain,
  non-linked address text with no map.
- Attempt to submit end time before start time in both the create form
  and the edit modal; confirm a clear validation error, not a silent
  save.
- Click "Share" on a scheduled event: confirm "Download Image" produces
  an on-brand PNG with the event's details, "Copy Link" copies a URL,
  and pasting that URL's `/share` page into a browser directly shows the
  OG meta in view-source and redirects to `/#events`.
- Edit an existing scheduled event's time range and confirm the homepage
  card updates accordingly.
- Type an address into the schedule form's "Exact Address" field and
  confirm a map preview appears inline (same panel, no save needed)
  after a short pause; open an already-scheduled event's edit view and
  confirm its map preview shows immediately from stored coordinates,
  then updates live if the address is edited.
- Schedule/view an event with no volunteer assigned and no partner
  charity: confirm no "Unassigned"/"self-delivered" line appears on the
  homepage card or in a downloaded share image. Assign a volunteer (or
  pick a partner charity) and confirm the correct line now appears.

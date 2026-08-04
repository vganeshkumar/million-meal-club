# Feature: Homepage Scheduled/Completed Events — Design

## Backend

### `app/models/domain.py`
`ContentResponse` gains one field:
```python
class ContentResponse(CamelModel):
    config: SiteConfig
    donors: list[Donor]
    events: list[EventItem]
    partner_charities: list[PartnerCharity]
    gallery: list[GalleryPhoto]
    donation_events: list[DonationEvent]  # NEW — public feed for #events
```
`DonationEvent` itself is unchanged and already public-safe (no email/
user_id-style internal fields) — the same model already returned to the
owning donor/volunteer is reused verbatim for the public feed.

### `app/services/store.py`
New protocol method:
```python
def list_all_donation_events(self) -> list[DonationEvent]:
    """Every DonationEvent, any donor, any status — powers the public
    #events Scheduled/Completed feed. See
    specs/features/014-homepage-scheduled-events/design.md."""
    ...
```
`get_content()` calls it and populates `ContentResponse.donation_events`.

### `local_store.py` / `dynamo_store.py`
`list_all_donation_events`: local — `[self._donation_event_from_row(e) for
e in self._donation_events.values()]`, sorted by `date`; DynamoDB — a
`scan()` over the `DonationEvents` table (same pattern `get_content()`
already uses for `donors`/`events`/`partner_charities`), sorted by `date`.

## Frontend

### `lib/types.ts`
`ContentResponse` gains `donationEvents: DonationEvent[]`.

### `app/page.tsx`
Content fetching splits from the mount-only effect so it re-runs every
time the visitor is looking at (or returns to) the home view:
```tsx
useEffect(() => {
  api.me().then(setUser).catch(() => setUser(null));
}, []);

useEffect(() => {
  if (view !== "home") return;
  api.getContent().then(setContent).catch(() => setContentError(true));
}, [view]);
```
`view` starts as `"home"`, so this still covers the original first-load
fetch — it just also re-fires on every navigation back to `"home"` (hash
cleared), which is what makes a freshly-scheduled donation event show up
without a hard reload.

### `components/Events.tsx`
Props widen to `{ events: EventItem[]; donationEvents: DonationEvent[] }`.
```tsx
const scheduledDonationEvents = donationEvents.filter((d) => d.status === "scheduled");
const completedDonationEvents = donationEvents.filter((d) => d.status === "submitted");
const hasScheduled = events.length > 0 || scheduledDonationEvents.length > 0;
const [tab, setTab] = useState<"scheduled" | "completed">("scheduled");
// Derived, not synced via an effect (avoids a setState-in-effect
// cascade): Completed wins whenever Scheduled is empty, regardless of
// the last explicit tab click.
const showScheduled = hasScheduled && tab === "scheduled";
```
A segmented Scheduled/Completed control (same visual pattern as
`AdminSignoff.tsx`'s tabs) sits above the grid; the Scheduled button is
`disabled` when `!hasScheduled`. Below it:
- **Scheduled tab**: existing community-event cards (unchanged markup)
  followed by a new, simpler donation-event card per scheduled
  `DonationEvent` (date, donor name, location, "Assigned to {name}" /
  "Unassigned" — no CTA).
- **Completed tab**: one card per `submitted` `DonationEvent` (date,
  donor name, location, volunteer name if any, a "Delivered" badge) — no
  CTA.
- Empty state per tab ("No scheduled events yet." / "No completed events
  yet.") when that tab's combined list is empty.

`data-testid="community-event-card"` / `data-testid="donation-event-card"`
on the two card variants — needed for reliable test targeting, same
rationale as `AdminSignoff.tsx`'s `signup-card` id
(specs/features/011-volunteer-application-approval).

## Tests
- Backend (`backend/tests/test_content_donation_events.py`, pytest): a
  freshly-created donation event appears in `GET /api/content`'s
  `donationEvents` with `status: "scheduled"`; after proof is submitted
  against it, the same call shows it `status: "submitted"`.
- Frontend (`frontend/e2e/homepage-scheduled-events.spec.ts`, Playwright):
  sign in as a dummy donor, schedule a donation event, navigate home,
  confirm it appears under the Scheduled tab; submit proof for it (via
  Gallery or by seeding through the API), navigate home again, confirm it
  now appears under Completed and no longer under Scheduled.

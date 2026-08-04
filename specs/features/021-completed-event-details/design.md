# Feature: Completed Event Details — Design

## 1. Backend: carrying photo/caption onto the public `DonationEvent`

Approving a submission already flips its linked `DonationEvent.status` to
`"completed"` ([[../020-donor-dashboard-lifecycle-nav/design]]). This
feature adds two more fields set at the same moment, in
`Store.approve_submission` (`local_store.py` / `dynamo_store.py`):

```python
event["photo_url"] = blob.public_url(approved_key)  # same key already
                                                      # computed for the
                                                      # Donation record
event["caption"] = s.get("caption") or None
```

Both are public-safe (a photo of a delivery, and whatever caption the
donor wrote) — no different from what already appears in `Donation.caption`
/ `Donation.photo_url` for the donor's own approved-donations list. Added
to `domain.py`'s `DonationEvent` model as
`photo_url: str | None = None` / `caption: str | None = None`.
`_donation_event_from_row` / `_donation_event_from_item` thread them
through on every read.

## 2. Backend: the receipt, donor-only

Two gaps closed:
1. `approve_submission` previously never carried `receipt_key` forward
   from the submission onto the `Donation` record it creates — it's added
   alongside `photo_key` (kept as the original `receipt_key`, *not*
   copied to the public `approved/` prefix the way the photo is — receipts
   stay under their private `pending/` key and are only ever read back via
   a fresh presigned URL, matching how admins already view them in
   `PendingSubmissions`).
2. A new `Store.list_donor_donation_receipts(donor_id) -> dict[str, str]`
   (donation_id → presigned receipt URL) is added to both backends.

### Why not just add `receipt_url` to `Donation`?
`Donation` is the element type of `Donor.donations`, and `Donor` is the
response model for the *public* `GET /donors/{id}` route (and the
`ContentResponse.donors` list) as well as `/donors/me` — adding the field
there would leak every donor's receipts to any site visitor. Instead:
- `Donation` (public) stays exactly as it was.
- A new `DonationMe(Donation)` model in `domain.py` adds
  `receipt_url: str | None = None`.
- `DonorMe` (already `/donors/me`-only, see
  [[../015-local-dev-generated-credentials/design]]) overrides
  `donations: list[DonationMe] | None = None` instead of inheriting
  `Donor`'s `list[Donation]`.
- `GET /donors/me` (`app/routers/donors.py`) builds the response by taking
  the normal (public-shaped) `Donor` from `get_donor()`, then merges in
  `list_donor_donation_receipts()` per-donation to build the `DonationMe`
  list:
  ```python
  donor = get_store().get_donor(donor_id)
  receipts = get_store().list_donor_donation_receipts(donor_id)
  donations_me = [
      DonationMe(**d.model_dump(), receipt_url=receipts.get(d.id))
      for d in (donor.donations or [])
  ]
  return DonorMe(**donor.model_dump(exclude={"donations"}), donations=donations_me, local_username=...)
  ```
This keeps the public `Donor`/`Donation` models structurally incapable of
carrying a receipt — there's no field to accidentally serialize.

## 3. Frontend types
`lib/types.ts`: `Donation` gains an optional `receiptUrl?: string` (present
only when fetched via `/donors/me`, absent — never even sent — elsewhere).
`DonationEvent` gains `photoUrl?: string` / `caption?: string`.

## 4. `components/DonorDashboard.tsx` — `CompletedEventsSection`
Each row becomes a `<button>` (was a `<div>`) that sets a local
`selected: Donation | null` state on click. A new `CompletedDonationModal`
(styled like the existing `SignInModal` overlay — fixed backdrop +
centered card, `×` to close, click-backdrop-to-close) shows meals/
location/date/caption/photo, plus a "View Receipt" link
(`target="_blank"`) when `donation.receiptUrl` is present — mirroring
`AdminSignoff.tsx`'s `PendingSubmissions` "View Receipt" treatment.

## 5. `components/Events.tsx` — completed `DonationEventCard`
`DonationEventCard` gains an optional `onClick`, only wired up when
`completed` — the Scheduled-tab cards stay non-interactive. The card
renders as a `<button>` instead of a `<div>` when completed, and shows a
photo thumbnail (`event.photoUrl`) at the top when present. `Events`
itself gains `selectedCompleted: DonationEvent | null` state and a new
`CompletedEventModal` (same visual treatment as `CompletedDonationModal`
in `DonorDashboard.tsx`, but no receipt — `DonationEvent` never carries
one) showing date, location, donor/volunteer line, caption, and photo.

No shared modal component was introduced — the two modals render
different shapes (`Donation` vs `DonationEvent`) and the codebase's
existing convention (`SignInModal`, `JoinInForm`) is self-contained,
per-file components rather than a shared UI library.

## Manual verification
Exercised end-to-end against the running dev servers: seeded a donor via
the API, scheduled a donation event, submitted proof with both a photo and
a receipt, approved it as admin, then confirmed via `curl`:
- `GET /donors/me` → `donations[0].receiptUrl` present.
- `GET /donors/{id}` (public) and `GET /content` → no `receiptUrl` field
  anywhere in the payload.
- `GET /donation-events/mine` and the public `content.donationEvents` →
  `status: "completed"`, `photoUrl`/`caption` populated.

Then via a real browser: clicked the event in Donor Dashboard → Completed
Events (modal shows photo + working "View Receipt" link) and in the
homepage Events → Completed tab (modal shows photo + caption + donor/
volunteer line, no receipt link).

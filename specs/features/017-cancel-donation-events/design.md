# Feature: Cancel Donation Events — Design

## Backend

### `app/models/domain.py`
`DonationEventStatus` gains a third value:
```python
DonationEventStatus = Literal["scheduled", "submitted", "cancelled"]
```
No other model changes — `DonationEvent.status` already types against this
alias.

### `Store` protocol / `local_store.py` / `dynamo_store.py`
New method, same "locked once final" shape as
`assign_donation_event_volunteer`:
```python
def cancel_donation_event(self, event_id: str) -> DonationEvent:
    """Raises ValueError if the event doesn't exist or is already
    submitted/cancelled."""
    ...
```

`get_content()`'s existing `_public_donation_events()` filter (added in
[[../016-admin-membership-status/design]] to exclude events tied to a
disabled donor/volunteer) gains one more condition: `status != "cancelled"`.
`list_all_donation_events()` itself, and
`list_donation_events_for_donor`/`_for_volunteer`, stay unfiltered — a
donor's own dashboard and the admin directory both still show a cancelled
event (marked as such), only the public homepage feed drops it. The admin
`GET /admin/donation-events?status=scheduled` endpoint already naturally
excludes it too, since its status is no longer `"scheduled"`.

### `app/routers/donation_events.py`
New endpoint:
```
POST /api/donation-events/{event_id}/cancel -> DonationEvent
```
Authorization: the caller must be either an admin (`user.is_admin`,
already on the session's `AuthUser`) or the donor who owns the event (same
`resolve_donor_id` + `event.donor_id` ownership check
`PATCH .../volunteer` already does). `404` if the event doesn't exist,
`403` if neither admin nor owner, `409` (via the store's `ValueError`) if
already submitted or already cancelled.

## Frontend

### `lib/types.ts` / `lib/api.ts`
`DonationEventStatus` gains `"cancelled"`. `api.cancelDonationEvent(id)`
POSTs to the new endpoint.

### `components/DonorDashboard.tsx`
`DonationEventsSection`'s event card: a "Cancel" button next to the
volunteer-assignment `<select>`, shown only when `status === "scheduled"`
(same guard already used for the assignment select). Status line gains a
`"cancelled"` branch ("Cancelled"). On success, `refresh()`s the list same
as `handleAssign`.

### `components/AdminDirectory.tsx`
`AdminEvents` (the admin's "upcoming events" tab, `status=scheduled` by
default): each card gets a "Cancel" button. On success, removes the event
from the local list (it's no longer "upcoming" — consistent with how
disable/reactivate on Donors/Volunteers instead *keeps* the row and flips
a badge, but here there's no "un-cancel" to come back to, so removal
matches what a re-fetch would show anyway).

### `components/VolunteerDashboard.tsx`
No change — `SubmitForDonorForm` already filters `assignedEvents` to
`status === "scheduled"`, so a cancelled event silently drops out of the
"which donation is this for" picker for free.

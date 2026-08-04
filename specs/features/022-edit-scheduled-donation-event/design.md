# Feature: Edit a Scheduled Donation Event — Design

## Backend

### `app/models/domain.py`
New request model, mirroring `CreateDonationEventRequest` minus
`volunteer_id` (assignment stays on its own endpoint):
```python
class UpdateDonationEventRequest(BaseModel):
    location: str
    date: str
    packet_count: int | None = None
    delivery_role: Literal["self", "volunteer_needed"] | None = None
    partner_charity: str | None = None
    notes: str | None = None
```

### `Store` protocol / `local_store.py` / `dynamo_store.py`
New method, same "locked once final" shape as `cancel_donation_event`:
```python
def update_donation_event(
    self,
    event_id: str,
    location: str,
    date: str,
    packet_count: int | None,
    delivery_role: str | None,
    partner_charity: str | None,
    notes: str | None,
) -> DonationEvent:
    """Raises ValueError if the event doesn't exist or isn't `scheduled`
    (submitted/completed/cancelled are all locked)."""
    ...
```
`local_store.py` overwrites the row's fields directly (clearing
`delivery_role`/`partner_charity`/`notes` to `None` when the request
omits them, unlike `create_donation_event` which only ever sets what it's
given — an edit is a full replace of these fields, not a patch-in). Same
shape for `dynamo_store.py`, using `SET`/`REMOVE` as appropriate per field
(same pattern `assign_donation_event_volunteer` already uses for
`volunteer_id`/`volunteer_name`).

### `app/routers/donation_events.py`
New endpoint:
```
PATCH /api/donation-events/{event_id} -> DonationEvent
```
Authorization: the caller must be the donor who owns the event **or**
the volunteer currently assigned to it — resolve both
`resolve_donor_id`/`resolve_volunteer_id` for the session and check
`event.donor_id == donor_id` or `event.volunteer_id == volunteer_id`
(mirrors the ownership check `cancel_donation_event`'s endpoint does for
admin-or-owner, extended with the assigned-volunteer case). `404` if the
event doesn't exist, `403` if neither, `409` (via the store's
`ValueError`) if not `scheduled`.

Volunteer assignment and cancellation stay on their existing endpoints
(`PATCH .../volunteer`, `POST .../cancel`) and their existing donor-only
authorization — this endpoint only ever touches
location/date/packet_count/delivery_role/partner_charity/notes.

## Frontend

### `lib/api.ts`
```ts
updateDonationEvent: (eventId: string, payload: {
  location: string;
  date: string;
  packet_count?: number;
  delivery_role?: "self" | "volunteer_needed";
  partner_charity?: string;
  notes?: string;
}) =>
  request<DonationEvent>(`/donation-events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }),
```

### `components/EditDonationEventModal.tsx` (new, shared)
A modal used by both dashboards: the same field set as
`ScheduleDonationSection`'s create form (location, date, packet count,
delivery role radios, partner charity, notes), pre-filled from the
passed-in `DonationEvent`, submitting via `api.updateDonationEvent`. Two
props gate the donor-only controls that move here from the list row:
- `canAssignVolunteer` — shows the assigned-volunteer `<select>`, wired to
  the existing `api.assignDonationEventVolunteer` exactly as
  `ScheduledEventsSection` does today.
- `canCancel` — shows a "Cancel Event" button wired to the existing
  `api.cancelDonationEvent`, exactly as `ScheduledEventsSection` does
  today.

Both are `true` for the donor dashboard's usage, `false` for the
volunteer dashboard's.

### `components/DonorDashboard.tsx`
`ScheduledEventsSection`'s card becomes a clickable button showing only
`{ev.date} — {ev.location}` and, if set, `{ev.packetCount} food packets`
— the "Assigned to X / Unassigned" line, the assignment `<select>`, and
the "Cancel" button all move into `EditDonationEventModal` (opened on
click, `canAssignVolunteer canCancel`). `ScheduledEventsSection` gains a
`partnerCharities` prop (already available in `DonorDashboard` and passed
through, same as it already is to `ScheduleDonationSection`).

### `components/VolunteerDashboard.tsx`
Gains a `partnerCharities` prop (passed from `app/page.tsx`, same as
`content?.partnerCharities` already passed to `DonorDashboard`).

Assigned-events fetching moves up from `SubmitForDonorForm` to
`VolunteerDashboard` itself (mirroring how `DonorDashboard` centralizes
`events` and passes `scheduledEvents` down to multiple sections) so both
the new list and the existing submit-proof picker stay in sync after an
edit: `VolunteerDashboard` adds `assignedEvents`/`refreshAssignedEvents`,
computes `scheduledAssignedEvents`, and passes it to both a new
`AssignedDonationEventsSection` (same card shape as the donor's
`ScheduledEventsSection`, opening `EditDonationEventModal` with
`canAssignVolunteer={false} canCancel={false}`) and to `SubmitForDonorForm`
(which drops its own fetch and takes `assignedEvents` as a prop instead).

## Manual verification
- As a donor: open a scheduled event from "Scheduled Events", confirm the
  list row shows no delivery detail, edit each field, save, confirm the
  row and modal reflect the change, and confirm assign/cancel still work
  from inside the modal.
- As the volunteer assigned to that event: open it from "My Assigned
  Donation Events" on the volunteer dashboard, confirm there's no
  assign/cancel control, edit a field, save, and confirm it's reflected
  on the donor's side too.
- Attempt to edit an event after submitting proof against it (via the
  API directly, or by submitting proof then reopening) and confirm a 409.

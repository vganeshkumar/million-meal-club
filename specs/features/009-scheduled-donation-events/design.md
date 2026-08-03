# Feature: Scheduled Donation Events — Design

## Data model

### `DonationEvents` table (new)
PK `event_id`. Denormalized for cheap reads (no joins needed to render
either the donor's or the volunteer's list):
- `donor_id`, `donor_name`
- `location`, `date` (`YYYY-MM-DD`)
- `volunteer_id` (nullable), `volunteer_name` (nullable — kept in sync
  whenever `volunteer_id` changes)
- `status`: `"scheduled" | "submitted"`
- `submission_id` (nullable — set once `submitted`)
- `created_at`

GSI `donor-index` on `donor_id` (donor's own list). GSI `volunteer-index`
on `volunteer_id` (volunteer's assigned list). Same on-demand billing as
every other table.

### `Submissions` — one new optional field
`donation_event_id: str | None` — set when a submission references a
donation event. Needed so `reject_submission` can look up and reopen the
event (see below); everything else about `Submissions` is unchanged.

## Backend

### `app/models/domain.py`
```python
DonationEventStatus = Literal["scheduled", "submitted"]

class DonationEvent(CamelModel):
    id: str
    donor_id: str
    donor_name: str
    location: str
    date: str
    volunteer_id: str | None = None
    volunteer_name: str | None = None
    status: DonationEventStatus = "scheduled"
    submission_id: str | None = None

class CreateDonationEventRequest(BaseModel):
    location: str
    date: str
    volunteer_id: str | None = None

class AssignVolunteerRequest(BaseModel):
    volunteer_id: str | None = None  # None clears the assignment

class VolunteerSummary(CamelModel):
    """Donor-facing directory entry for the assignment picker — same public
    fields as `Volunteer` minus `events` (irrelevant here, and avoids an
    RSVP join per volunteer just to populate a picker)."""
    id: str
    name: str
    location: str
    packets_per_trip: int | None = None
    availability: str | None = None
```
`SubmissionRequest` gains `donation_event_id: str | None = None`.
`SubmissionAdminView` gains `donation_event_id: str | None = None` (purely
informational for the admin screen — not required, doesn't change
approve/reject behavior there).

### `app/services/store.py` (Protocol additions)
```python
def list_volunteers(self) -> list[Volunteer]:
    """Donor-facing directory for the assignment picker — see
    GET /api/volunteers."""
    ...

def create_donation_event(
    self, donor_id: str, donor_name: str, location: str, date: str,
    volunteer_id: str | None, volunteer_name: str | None,
) -> DonationEvent: ...

def list_donation_events_for_donor(self, donor_id: str) -> list[DonationEvent]: ...

def list_donation_events_for_volunteer(self, volunteer_id: str) -> list[DonationEvent]: ...

def get_donation_event(self, event_id: str) -> DonationEvent | None: ...

def assign_donation_event_volunteer(
    self, event_id: str, volunteer_id: str | None, volunteer_name: str | None,
) -> DonationEvent:
    """Raises ValueError if the event is already `submitted` — reassignment
    is locked once proof has been submitted against it."""
    ...
```
`create_submission` gains `donation_event_id: str | None = None`. When
present, it atomically also flips the referenced `DonationEvent` to
`submitted` (storing the new `submission_id` on it) as part of the same
call — this is what enforces "one submission per event" (see
`submissions.py` below for the pre-check that makes the 409 message
readable instead of a raw write failure).

`reject_submission` — if the rejected submission has a `donation_event_id`,
reopen that event: `status` back to `scheduled`, `submission_id` cleared.
`approve_submission` needs no event-side change — `submitted` already
means "closed to further submissions," which stays true after approval.

### `app/routers/donation_events.py` (new)
- `POST /api/donation-events` — donor only (`resolve_donor_id`, else
  `403`). Body: `CreateDonationEventRequest`. If `volunteer_id` given,
  `get_store().get_volunteer(...)` to resolve `volunteer_name` (`404` if
  unknown). Returns the created `DonationEvent`.
- `GET /api/donation-events/mine` — donor only. Returns
  `list_donation_events_for_donor`, sorted by `date` ascending.
- `PATCH /api/donation-events/{event_id}/volunteer` — donor only, and only
  the owning donor (`event.donor_id == resolve_donor_id(...)`, else
  `403`). Body: `AssignVolunteerRequest`. `409` if the event is already
  `submitted` ("Can't reassign — proof has already been submitted for this
  donation event."). Resolves `volunteer_name` the same way as create.
- `GET /api/donation-events/volunteer-assigned` — volunteer only
  (`resolve_volunteer_id`, else `403`). Returns
  `list_donation_events_for_volunteer`, sorted by `date` ascending.

### `app/routers/volunteers.py` — one new endpoint
- `GET /api/volunteers` — donor only (`resolve_donor_id`, else `403`,
  message: "Only donors can view the volunteer directory."). Returns
  `list_volunteers()` as `list[VolunteerSummary]`. Placed here (not the new
  router) since it's about volunteers, not donation events, and mirrors
  where `/volunteers/me` already lives.

### `app/routers/submissions.py` — new `donation_event_id` branch
```python
if body.donation_event_id:
    event = store.get_donation_event(body.donation_event_id)
    if event is None:
        raise HTTPException(404, "Donation event not found")
    if event.status == "submitted":
        raise HTTPException(409, "Proof has already been submitted for this donation event.")
    donor_id_of_user = store.resolve_donor_id(user_id, user.email)
    volunteer_id_of_user = store.resolve_volunteer_id(user_id, user.email)
    is_owning_donor = event.donor_id == donor_id_of_user
    is_assigned_volunteer = (
        event.volunteer_id is not None and event.volunteer_id == volunteer_id_of_user
    )
    if not (is_owning_donor or is_assigned_volunteer):
        raise HTTPException(403, "You're not the donor or assigned volunteer for this donation event.")
    donor_id = event.donor_id
    location = location or event.location  # event location wins if the form left it blank
elif body.donor_id:
    ... # existing free-text volunteer-on-behalf-of path, unchanged
else:
    ... # existing self-submission path, unchanged
```
`donation_event_id` and `donor_id` are mutually exclusive in practice (the
frontend never sends both); if somehow both are present,
`donation_event_id` wins and `donor_id` is ignored, since it carries
stronger, pre-validated authorization.

`store.create_submission(..., donation_event_id=body.donation_event_id)` —
threaded straight through so the event-closing side effect described above
happens as part of the same store call.

## Frontend

### `lib/types.ts`
```ts
export type DonationEventStatus = "scheduled" | "submitted";

export type DonationEvent = {
  id: string;
  donorId: string;
  donorName: string;
  location: string;
  date: string;
  volunteerId?: string;
  volunteerName?: string;
  status: DonationEventStatus;
  submissionId?: string;
};

export type VolunteerSummary = {
  id: string;
  name: string;
  location: string;
  packetsPerTrip?: number;
  availability?: string;
};
```
`SubmissionPayload` gains `donation_event_id?: string`.

### `lib/api.ts`
```ts
listVolunteers: () => request<VolunteerSummary[]>("/volunteers"),
listMyDonationEvents: () => request<DonationEvent[]>("/donation-events/mine"),
createDonationEvent: (payload: { location: string; date: string; volunteer_id?: string }) =>
  request<DonationEvent>("/donation-events", { method: "POST", body: JSON.stringify(payload) }),
assignDonationEventVolunteer: (eventId: string, volunteerId: string | null) =>
  request<DonationEvent>(`/donation-events/${eventId}/volunteer`, {
    method: "PATCH",
    body: JSON.stringify({ volunteer_id: volunteerId }),
  }),
listVolunteerAssignedEvents: () =>
  request<DonationEvent[]>("/donation-events/volunteer-assigned"),
```

### `components/DonorDashboard.tsx`
New "Scheduled Donation Events" section:
- A "Schedule a donation" form (location, date, optional volunteer
  `<select>` populated from `api.listVolunteers()`) calling
  `api.createDonationEvent`.
- The donor's own events (`api.listMyDonationEvents()`), each showing
  location/date/status and, for `scheduled` ones, a volunteer
  reassignment `<select>` (`api.assignDonationEventVolunteer`, refetches on
  change).

### `components/Gallery.tsx`
When `user?.isDonor`, fetches `api.listMyDonationEvents()` and, if any are
`scheduled`, shows a `<select>` above the location field: "Which scheduled
donation is this for? — None (unplanned) / <location> — <date>...". On
selection:
- Sets `donation_event_id` on submit.
- Auto-fills and locks the location field to the event's location.
- If the event has a `volunteerName`, shows a read-only line: "Volunteer:
  <name>" (the "autopopulate" requirement).

### `components/VolunteerDashboard.tsx` (`SubmitForDonorForm`)
Gains the same kind of `<select>`, populated from
`api.listVolunteerAssignedEvents()` filtered to `status === "scheduled"`:
"Which donation is this for? — Enter a donor ID manually / <donorName> —
<location> — <date>". Selecting an event:
- Sets `donation_event_id` instead of `donor_id` on submit.
- Shows a read-only "Donor: <donorName>" line (the other half of
  "autopopulate").
- Hides the free-text Donor ID field (only shown when "Enter a donor ID
  manually" is selected, preserving the existing fallback per
  requirements.md).

## Infra
`infra/modules/data`: new `DonationEvents` table (`donor-index`,
`volunteer-index` GSIs), on-demand billing, same pattern as every other
table here. `infra/modules/api`: new env var `DONATION_EVENTS_TABLE`; the
Lambda IAM policy needs no new statement — `table_arns` (from
`modules/data`'s output) already generically covers every table + GSI.

## Cross-references
- [[../008-persona-dashboards-and-roles/design]] — the donor/volunteer
  claiming mechanism and dashboards this builds directly on top of.
- [[../../01-architecture]] — gets a new table entry and a short note under
  "Donor approval & claiming".

# Feature: Volunteer Profile — Full Application Fields Editable — Design

## Backend

### `app/models/domain.py`
`Volunteer` gains the two fields that were never persisted before
(`packets_per_trip`/`availability` already exist on it since
[[../008-persona-dashboards-and-roles/design]]):

```python
class Volunteer(CamelModel):
    id: str
    name: str
    location: str
    country: str = ""
    packets_per_trip: int | None = None
    availability: str | None = None
    volunteering_history: str | None = None
    references: str | None = None
    events: list[EventItem]
```

`VolunteerMe` inherits unchanged. `VolunteerSummary` (the donor-facing
directory model) is deliberately **not** extended — it stays scoped to the
fields already public today, keeping `volunteering_history`/`references`
private per the requirements.

`UpdateVolunteerProfileRequest` grows to match everything the form now
submits, same "every field required except the two that were already
optional at signup" shape as `packets_per_trip`/`availability` being
required in `SignupRequest`'s volunteer-mode validator:

```python
class UpdateVolunteerProfileRequest(BaseModel):
    location: str
    country: str
    packets_per_trip: int
    availability: str
    volunteering_history: str | None = None
    references: str | None = None
```

### `Store` protocol / `local_store.py` / `dynamo_store.py`
`update_volunteer_profile` grows the same four params:

```python
def update_volunteer_profile(
    self,
    volunteer_id: str,
    location: str,
    country: str,
    packets_per_trip: int,
    availability: str,
    volunteering_history: str | None,
    references: str | None,
) -> Volunteer: ...
```

`LocalStore.update_volunteer_profile`: mutate the six keys on
`self._volunteers[volunteer_id]` in place, then return via the existing
`get_volunteer` reconstruction.

`DynamoStore.update_volunteer_profile`: extend the `update_item`
`UpdateExpression` to `SET #l = :l, country = :c, packets_per_trip = :p,
availability = :a, volunteering_history = :vh, references = :r`, then
re-`get_volunteer`.

Both `get_volunteer` implementations already read `packets_per_trip`/
`availability` off the stored row — add `volunteering_history`/`references`
reads alongside them.

**`approve_signup`** (both stores): today, when `mode == "volunteer"`, the
new `_volunteers[volunteer_id]` row only copies `packets_per_trip`/
`availability` off the signup — extend it to also copy
`volunteering_history`/`references` off the signup row, so there's
something to prefill in the new form immediately after approval (matches
this feature's requirement that these become real `Volunteer` fields, not
just signup-review-only fields).

### `app/routers/volunteers.py`
`update_my_volunteer` passes the four new fields through to
`store.update_volunteer_profile` alongside the existing two. No change to
the route's auth/404 shape.

## Frontend

### `lib/types.ts`
`Volunteer` type gains `volunteeringHistory?: string` and `references?:
string` (camelCase per `CamelModel`'s `to_camel` alias generator —
`volunteering_history` → `volunteeringHistory`, `references` is already
camelCase).

### `lib/api.ts`
```ts
updateMyVolunteer: (payload: {
  location: string;
  country: string;
  packets_per_trip: number;
  availability: string;
  volunteering_history?: string;
  references?: string;
}) =>
  request<Volunteer>("/volunteers/me", { method: "PATCH", body: JSON.stringify(payload) }),
```

### `components/VolunteerDashboard.tsx`
`ProfileSection` gains four more controlled fields, prefilled from the
`volunteer` prop, using the same label copy/placeholders as the volunteer
branch of `JoinInForm.tsx`:
- "Packets You Can Handle Per Trip" — `type="number"`, `min={1}`, required.
- "Availability" — text, placeholder `"e.g. weekends, evenings, flexible"`,
  required.
- "Prior Volunteering Experience (optional)" — `textarea`.
- "Donor References (optional)" — `textarea`.

Same card/field styling already used in this component (`fieldClass`/
`labelClass`), submit button and save/error status handling unchanged.

## Tests
- `backend/tests/test_profile_edit.py`: extend
  `test_volunteer_can_update_their_own_profile` to also send/assert
  `packets_per_trip`/`availability`/`volunteering_history`/`references`;
  extend `_approve_volunteer` (or add a variant) to seed a signup with
  `volunteering_history`/`references` so a new test can assert those values
  land on the `Volunteer` record immediately after approval (before any
  profile edit); add a `test_volunteer_directory_omits_private_fields` (or
  extend an existing volunteers-directory test) asserting
  `volunteering_history`/`references` never appear in `GET /volunteers`
  responses.
- `frontend/e2e/profile-edit.spec.ts`: extend the volunteer flow to fill and
  save the four new fields, reload, and confirm they persisted.

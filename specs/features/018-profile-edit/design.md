# Feature: Profile Editing (Donor & Volunteer) — Design

## Backend

### `app/models/domain.py`
Two new request models, following the same "only provided fields change"
shape as `ConfigUpdateRequest`, but here every field is actually required
(location/country always; story for donors) since the frontend always
submits the full editable set from a prefilled form — no partial-patch
semantics needed:

```python
class UpdateDonorProfileRequest(BaseModel):
    location: str
    country: str
    story: str


class UpdateVolunteerProfileRequest(BaseModel):
    location: str
    country: str
```

### `Store` protocol / `local_store.py` / `dynamo_store.py`
Two new methods:

```python
def update_donor_profile(
    self, donor_id: str, location: str, country: str, story: str
) -> Donor: ...

def update_volunteer_profile(
    self, volunteer_id: str, location: str, country: str
) -> Volunteer: ...
```

`LocalStore`: mutate the `self._donors[donor_id]` / `self._volunteers[volunteer_id]`
dict in place (`location`, `country`, `story`/nothing-else), then return via
the existing `get_donor`/`get_volunteer` reconstruction so the response shape
matches every other read path exactly.

`DynamoStore`: a `update_item` with `SET location = :l, country = :c[, story
= :s]`, then re-`get_item` (or just re-`get_donor`/`get_volunteer`) to return
the fresh row — same pattern `set_donor_status` already uses for the
`UpdateExpression`, just with more attributes.

### `app/routers/donors.py` / `app/routers/volunteers.py`
Two new endpoints, mirroring the existing `/me` GET routes' auth shape
(`resolve_donor_id`/`resolve_volunteer_id` off the session, 404 if not
linked):

```
PATCH /api/donors/me      body: UpdateDonorProfileRequest      -> Donor
PATCH /api/volunteers/me  body: UpdateVolunteerProfileRequest  -> Volunteer
```

Both 404 the same way the GET `/me` routes do when the caller isn't linked to
an approved donor / registered volunteer. No separate admin-editing-another's-
profile endpoint — out of scope per requirements.

## Frontend

### `lib/api.ts`
```ts
updateMyDonor: (payload: { location: string; country: string; story: string }) =>
  request<Donor>("/donors/me", { method: "PATCH", body: JSON.stringify(payload) }),
updateMyVolunteer: (payload: { location: string; country: string }) =>
  request<Volunteer>("/volunteers/me", { method: "PATCH", body: JSON.stringify(payload) }),
```
No new types needed in `lib/types.ts` — both reuse the existing `Donor`/
`Volunteer` response shape.

### `components/DonorDashboard.tsx`
New `ProfileSection` subcomponent, rendered above `DonationEventsSection`
(same card styling: `rounded-2xl border border-border bg-card p-5`, same
`fieldClass`/`labelClass` used elsewhere in this file). Local form state
initialized from `donor.location`/`donor.country`/`donor.story`; a save
button disabled while saving; on success, updates the parent's `donor` state
(via a passed-down setter, same lift-state-up shape the file already uses for
`DonationEventsSection`'s `donorCountry` prop) so the header line and the
donor-spotlight-facing fields all reflect the change without a refetch.
Country field uses `<select>` off `COUNTRIES` from `lib/countries.ts`
(imported the same way `JoinInForm.tsx` does), not a free-text input.

### `components/VolunteerDashboard.tsx`
Same idea, a `ProfileSection` with just location + country, using
`volunteer`/`setVolunteer` the same way.

### Tests
- `backend/tests/test_profile_edit.py`: donor can update their own
  location/country/story and `GET /donors/me` reflects it; volunteer same for
  location/country; a signed-in user with no linked donor/volunteer gets 404
  on the respective PATCH; another donor's PATCH only ever touches their own
  row (each test's donor is independently seeded, so no cross-donor
  assertion needed beyond what `resolve_donor_id` already guarantees).
- `frontend/e2e/profile-edit.spec.ts`: donor signs in (dummy local login,
  same pattern as `cancel-donation-events.spec.ts`), edits location/country/
  story from "My Donations", saves, reloads, confirms the new values persisted.

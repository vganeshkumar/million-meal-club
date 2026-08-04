# Feature: Admin Membership Status — Design

## Data model
No new tables. `Donors` and `Volunteers` rows (both `local_store.py` and
`dynamo_store.py`) gain a `status` field — `"active" | "disabled"`, set to
`"active"` by `approve_signup` when the row is first created (see
[[../011-volunteer-application-approval/design]]). Rows created before this
feature (the seeded local-dev demo donors) have no `status` key; every read
path treats a missing key as `"active"` (`.get("status", "active")`) so no
migration/backfill is needed.

## Backend

### New models (`app/models/domain.py`)
```python
MembershipStatus = Literal["active", "disabled"]

class DonorAdminView(BaseModel):
    donor_id: str
    name: str
    location: str
    country: str = ""
    email: str
    total_meals: int
    donation_count: int
    status: MembershipStatus

class VolunteerAdminView(BaseModel):
    volunteer_id: str
    name: str
    location: str
    country: str = ""
    email: str
    packets_per_trip: int | None = None
    availability: str | None = None
    status: MembershipStatus
```
Plain `BaseModel` (snake_case wire format), same convention as the existing
`SignupAdminView`/`SubmissionAdminView` — deliberately distinct from the
public `Donor`/`Volunteer` `CamelModel`s, which must never gain `status` or
`email`. Admin's "upcoming events" tab reuses the existing `DonationEvent`
model as-is.

### `Store` protocol / `local_store.py` / `dynamo_store.py`
New methods:
- `list_all_donors() -> list[DonorAdminView]` / `list_all_volunteers() ->
  list[VolunteerAdminView]` — every row, any status.
- `set_donor_status(donor_id, status) -> None` / `set_volunteer_status
  (volunteer_id, status) -> None`.
- `is_membership_disabled(user_id, email) -> bool` — true if any Donor or
  Volunteer row matching this identity (linked `user_id`, **or** `email` —
  same find-by-either shape `resolve_donor_id`/`resolve_volunteer_id`
  already use) has `status == "disabled"`.

Changed behavior:
- `get_content()`: `donors` excludes disabled donors; `donation_events`
  excludes any event whose `donor_id` or `volunteer_id` resolves to a
  disabled donor/volunteer. `list_all_donation_events()` itself stays
  unfiltered (the admin Events tab needs the full picture) — the filter is
  a step inside `get_content()` only.
- `get_donor(donor_id)`: returns `None` for a disabled donor (existing
  `routers/donors.py` `get_donor` already 404s on `None` — no router
  change needed there).
- `list_volunteers()` (the donor-facing volunteer-assignment picker):
  excludes disabled volunteers, for the same reason a disabled donor is
  hidden — no newly creatable link to a disabled member.

### `app/routers/admin.py` — new endpoints, all behind `require_admin`
```
GET  /api/admin/donors                          -> list[DonorAdminView]
GET  /api/admin/volunteers                       -> list[VolunteerAdminView]
GET  /api/admin/donation-events?status=scheduled -> list[DonationEvent]
POST /api/admin/donors/{donor_id}/disable        -> 204
POST /api/admin/donors/{donor_id}/reactivate     -> 204
POST /api/admin/volunteers/{volunteer_id}/disable    -> 204
POST /api/admin/volunteers/{volunteer_id}/reactivate -> 204
```
`donation-events` filters `list_all_donation_events()` by the `status`
query param in the router (default `"scheduled"`), the same
query-param-filter pattern `list_submissions`/`list_signups` already use.

### `app/routers/auth.py`
`sign_in_google`, `sign_in_facebook`, and the non-`dummy_user` branch of
`sign_in_dummy` call a new check right after `get_or_create_user(...)` and
before the session cookie is set:
```python
if get_store().is_membership_disabled(user_id, email):
    raise HTTPException(403, "This account has been disabled...")
```
No cookie is set, no session issued, if this raises. The `dummy_user` admin
shortcut branch is unaffected (it isn't a donor/volunteer identity).

## Frontend

### `lib/types.ts` / `lib/api.ts`
`MembershipStatus` type; `DonorAdminView`/`VolunteerAdminView` (snake_case,
mirroring `SignupAdminView`). `api.listAllDonors`, `listAllVolunteers`,
`listUpcomingDonationEvents`, `disableDonor`, `reactivateDonor`,
`disableVolunteer`, `reactivateVolunteer`.

### `components/AdminDirectory.tsx` (new)
`AdminDonors` / `AdminVolunteers`: fetch-on-mount list (same shape as
`PendingApplications`/`PendingSubmissions` in `AdminSignoff.tsx`), one card
per row with a status badge and a single toggle button — "Disable" when
active, "Reactivate" when disabled — that flips the row's status in local
state on success (no removal from the list; the admin needs to keep seeing
disabled rows to reactivate them later).

`AdminEvents`: fetches `listUpcomingDonationEvents()`, read-only cards
(date, location, donor name, volunteer name or "Unassigned") — same visual
language as `Events.tsx`'s `DonationEventCard`.

### `components/AdminSignoff.tsx`
`AdminTabs`'s tab union grows to `"applications" | "submissions" |
"donors" | "volunteers" | "events"`, three more tab buttons (same styling),
rendering the three new components above.

### Homepage — no changes
`page.tsx`, `FeaturedDonors.tsx`, `Events.tsx` already just render whatever
`GET /api/content` returns; filtering happens entirely server-side.

## Infra
None — DynamoDB is schemaless beyond declared keys/GSIs; adding a `status`
attribute to existing `Donors`/`Volunteers` items needs no Terraform change.

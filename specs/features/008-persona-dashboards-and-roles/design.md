# Feature: Persona Dashboards & Roles — Design

## Data model

### `Volunteers` table (new — mirrors `Donors`)
PK `volunteer_id`. `name`, `location`, `email` (internal only, claim-
matching — never returned publicly), `user_id` (unset until claimed),
`packets_per_trip`, `availability`. GSI `email-index` (claim lookup), GSI
`user-index` (already-linked lookup) — identical shape to `Donors`' two
GSIs.

Unlike `Donors`, there's no approval gate: `create_signup` creates the
`Volunteers` row **immediately** for `mode == "volunteer"` (unclaimed),
mirroring what `approve_signup` does for donors but without the admin step
in between — matches today's "volunteers just register" behavior.

### `EventSignups` table (new — RSVP)
PK `volunteer_id`, SK `event_id`. `created_at`. GSI `event-index` on
`event_id` (unused today — reserved for a future admin headcount view, see
requirements.md "Out of scope").

### `Donors` / `Submissions` — no schema change
`Submissions` gains two **optional** fields on the request/item, not new
columns requiring a migration: `delivery_role`, `partner_charity` (same
values as the original donor application — see "Register a new donation"
below), and `donor_id` (see "Submit on behalf of a donor" below).

## Backend

### Donor/volunteer resolution — refactored from raising to `Optional`
`resolve_donor_id` (see [[../007-donor-application-approval/design]]) no
longer raises `DonorNotApprovedError`; it returns `str | None`. Callers
decide what "not found" means for their endpoint:
```python
def resolve_donor_id(self, user_id: str, email: str) -> str | None:
    # 1. already linked? 2. claim by email? 3. return None (no raise)
    ...

def resolve_volunteer_id(self, user_id: str, email: str) -> str | None:
    # identical shape, against Volunteers instead of Donors
    ...
```
`DonorNotApprovedError` is removed. `uploads.py`/`submissions.py` now do:
```python
donor_id = get_store().resolve_donor_id(user_id, email)
if donor_id is None:
    raise HTTPException(403, DONOR_NOT_APPROVED_DETAIL)
```
This is a cleaner control-flow (no exception-as-control-flow) and is what
`GET /api/donors/me` needs anyway (a `None` result there means "show the
apply-first empty state", not a hard error).

### New/changed endpoints
- `GET /api/donors/me` — auth required. `resolve_donor_id`; `404` if
  `None`, else the same shape as `GET /api/donors/{id}`.
- `GET /api/volunteers/me` — auth required. `resolve_volunteer_id`; `404`
  if `None`, else `{ id, name, location, packetsPerTrip, availability,
  events: EventItem[] }` (their RSVP'd events, joined from
  `EventSignups` + the `Events` table).
- `POST /api/events/{event_id}/rsvp`, `DELETE /api/events/{event_id}/rsvp`
  — auth required; `403` if `resolve_volunteer_id` is `None` ("register as
  a volunteer first"); otherwise create/delete the `EventSignups` row.
- `GET /api/admin/submissions?status=pending` — **unchanged**, already
  exists; just finally gets a frontend screen (see below).
- `POST /api/submissions` — `SubmissionRequest` gains:
  - `delivery_role: Literal["self", "volunteer_needed"] | None`,
    `partner_charity: str | None` — stored on the resulting `Donations`
    item once approved, same treatment as the equivalent application-time
    fields; purely descriptive, no new validation.
  - `donor_id: str | None` — **submit-on-behalf-of-a-donor** path: if
    present, the submitter must resolve to a linked volunteer (`403`
    otherwise: "only registered volunteers can submit on behalf of a
    donor"), and the submission is attributed directly to `donor_id`
    instead of the submitter's own `resolve_donor_id`. If absent, behavior
    is unchanged (submitter must resolve their own linked donor).

### `POST /api/auth/dummy` — role picker, credential change
```python
class DummyLoginRequest(BaseModel):
    username: str
    password: str
    role: Literal["admin", "donor", "volunteer"]
```
Credentials become `dummy_user` / `dummy_password` (was `dummy`/`dummy`).
Behavior per role, all still gated behind `ENABLE_DUMMY_LOGIN=true`:
- `role == "admin"` — unchanged: session email = first `ADMIN_EMAILS`
  entry.
- `role == "donor"` — `get_or_create_user("dummy", "dummy-donor",
  "dummy-donor@local.test", "Dummy Donor")`, then **idempotently**
  ensure a `Donors` row exists for that email, already linked
  (`user_id` set) and already carrying one sample approved donation (so
  "My Donations" isn't empty on first look) — created once, reused on
  subsequent dummy-donor logins rather than duplicated.
- `role == "volunteer"` — same idea against `Volunteers`
  (`dummy-volunteer@local.test`, sample `packets_per_trip`/`availability`).

This is a **local-testing convenience only** — it doesn't touch or
shortcut the real apply → admin-approve pipeline, which remains separately
testable via the `admin` role + the real Join In form (as already verified
end-to-end for donors in [[../007-donor-application-approval/tasks]]).

## Frontend

### Sign-in entry point (bug fix)
The dummy-login form (radio/select for role + username/password, shown
only when `NEXT_PUBLIC_ENABLE_DUMMY_LOGIN === "true"`) moves **into**
`SignInModal.tsx` itself, alongside the existing Google/Facebook buttons —
not a separate page. `Header.tsx`'s "Sign In" button (already
unconditionally visible) is now the one entry point for every persona.
Once signed in, `Header.tsx` conditionally shows "Admin" / "My Donations" /
"My Volunteering" links based on `user.isAdmin` / `isDonor` / `isVolunteer`
— each links to its own hash route and handles its own "you don't have
this role yet" empty state, so there's no more hidden/unreachable page.

### `#admin` — now a two-section dashboard
`AdminSignoff.tsx` (existing) is joined by a new submissions-review
section in the same `#admin` view (simple client-side tab state — no new
hash route needed for the tab switch itself): "Applications" (existing)
and "Submissions" (new, mirrors it: list, photo/receipt preview via the
presigned URLs already in `SubmissionAdminView`, Approve/Reject).

### `#my-donations` (new) — `components/DonorDashboard.tsx`
Fetches `GET /api/donors/me`. `404` → empty state ("You're not an approved
donor yet") linking to `#participate`. Otherwise renders the same
stats/story/deliveries layout as `DonorDetail.tsx` (consider extracting
shared presentational pieces rather than duplicating markup) plus a
"Register a New Donation" CTA that scrolls to the Gallery submit-proof
section — per the "recommended" interpretation in requirements.md, this
*is* the Gallery form, not a separate flow.

### `#my-volunteering` (new) — `components/VolunteerDashboard.tsx`
Fetches `GET /api/volunteers/me`. `404` → empty state linking to
`#participate`. Otherwise: profile summary, the events list
(`content.events`) each with an RSVP toggle calling
`POST`/`DELETE /api/events/{id}/rsvp`, and a "Submit Proof For A Donor"
form — the same fields as `Gallery.tsx`'s form plus a `<select>` of donors
(from `content.donors`, already public) setting `donor_id` on submit.

### `Gallery.tsx`
Gains the `delivery_role` radio + `partner_charity` select (same options
as `JoinInForm.tsx`'s donor mode) as optional fields on the submit-proof
form, per "Register a new donation" above.

### `lib/types.ts` / `lib/api.ts`
- `AuthUser` gains `isDonor: boolean`, `isVolunteer: boolean`.
- `api.signInDummy(username, password, role)` — role param added.
- `api.getMyDonor()`, `api.getMyVolunteer()`, `api.rsvpToEvent(id)`,
  `api.cancelRsvp(id)`, `api.listPendingSubmissions()`,
  `api.approveSubmission(id)`, `api.rejectSubmission(id)`.
- `SubmissionPayload` gains `delivery_role?`, `partner_charity?`,
  `donor_id?`.

## Infra
`infra/modules/data`: new `Volunteers` table (`email-index`, `user-index`
GSIs) and `EventSignups` table (`event-index` GSI) — same on-demand
billing as every other table. `infra/modules/api`: new env vars
`VOLUNTEERS_TABLE`, `EVENT_SIGNUPS_TABLE`; IAM policy's `table_arns` list
(from `modules/data`) picks these up automatically since it's already a
generic "all table + index ARNs" list — no new IAM statement needed beyond
what the existing `DynamoDbAccess` statement already grants.

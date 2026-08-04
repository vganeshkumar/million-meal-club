# Feature: Volunteer Application Approval — Design

## Backend

### Models (`app/models/domain.py`)
- `SignupRequest` gains two fields, both `mode == "volunteer"` only, both
  optional (no new `model_validator` branch — unlike donor mode's required
  fields, these stay free-form):
  ```python
  volunteering_history: str | None = None
  references: str | None = None
  ```
- `SignupAdminView` gains the volunteer-mode fields it was previously
  missing entirely (before this change, volunteer signups never reached
  `requested_signoff`, so the admin view never needed them):
  ```python
  packets_per_trip: int | None = None
  availability: str | None = None
  volunteering_history: str | None = None
  references: str | None = None
  ```
  (`SignupAdminView` is a plain `BaseModel`, not `CamelModel` — stays
  snake_case on the wire, same as today.)
- No change to `AuthUser`, `SignupStatus`, or `SignupResponse`.

### `app/services/email.py`
`EmailSender` gains a second method, same shape as the existing one:
```python
class EmailSender(Protocol):
    def send_donor_onboarded(self, to_email: str, name: str) -> None: ...
    def send_volunteer_onboarded(self, to_email: str, name: str) -> None: ...
```
- `LocalEmailSender.send_volunteer_onboarded` — logs
  `f"[email] would send onboarding email to {to_email} ({name})"` (same
  message shape as the donor one, only the log call differs).
- `SesEmailSender.send_volunteer_onboarded` — same `Source`/`send_email`
  mechanics as `send_donor_onboarded`, subject "You're approved as a
  volunteer at {charity_name}!", body confirming they can now sign in and
  RSVP / submit proof on a donor's behalf.

### `create_signup` (`local_store.py` / `dynamo_store.py`)
Collapses to one path for both modes — no more `if payload.mode == "donor"`
branch that creates a `Volunteers` row inline for the volunteer case:
```python
item["status"] = "requested_signoff"
```
unconditionally (for both `"donor"` and `"volunteer"`). The
`payload.model_dump()` spread already carries `volunteering_history` /
`references` onto the stored signup item — no extra plumbing needed,
identical to how `donor_story` already flows through today.

### `approve_signup` (`local_store.py` / `dynamo_store.py`)
Branches on the signup's `mode` to decide which record to create, and
returns `mode` alongside `(name, email)` so the router knows which
onboarding email to send:
```python
def approve_signup(self, signup_id: str) -> tuple[str, str, str]:
    signup = ...  # existing lookup/status-check, unchanged
    signup["status"] = "approved"  # / update_item, unchanged mechanics
    name = signup.get("name") or "Anonymous"
    email = signup["email"]
    mode = signup["mode"]
    if mode == "donor":
        # unchanged: create the Donors row from donor_story etc.
        ...
    else:
        # what create_signup used to do inline for mode == "volunteer",
        # moved here — same fields, same "unclaimed" shape (no user_id).
        volunteer_id = uuid.uuid4().hex
        # put/insert into Volunteers: id, name, location, country, email,
        # packets_per_trip, availability
    return name, email, mode
```
(DynamoDB version: same `put_item` shape `create_signup` used to use for
the volunteer branch, just invoked from `approve_signup` instead, guarded
by the existing `ConditionExpression`/status-check pattern
`approve_signup` already has for donors.)

### `app/routers/admin.py`
```python
@router.post("/signups/{signup_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_signup(signup_id: str, session: Session = Depends(require_admin)) -> None:
    name, email, mode = get_store().approve_signup(signup_id)
    if mode == "donor":
        get_email_sender().send_donor_onboarded(email, name)
    else:
        get_email_sender().send_volunteer_onboarded(email, name)
```
`reject_signup` and `list_signups` are unchanged — they were already
mode-agnostic (`list_signups(status)` just filters on `status`, which
volunteer signups now also carry).

### `Store` protocol (`app/services/store.py`)
- `approve_signup(signup_id) -> tuple[str, str, str]` (name, email, mode) —
  return type widens from the donor-only `tuple[str, str]`.
- `create_signup`'s docstring updates to drop the "For mode == 'volunteer',
  also creates an unclaimed Volunteers row immediately" line — that no
  longer happens here.
- No change to `resolve_volunteer_id`, `resolve_donor_id`,
  `provision_dummy_volunteer` — see requirements.md "Claiming" section for
  why the existing mechanism already does the right thing once
  `Volunteers` rows only exist post-approval.

## Frontend

### `components/JoinInForm.tsx`
- Volunteer mode gains two new optional fields, placed after Availability
  and before the shared Notes field:
  ```tsx
  <label className={labelClass}>
    Prior Volunteering Experience (optional)
    <textarea name="volunteering_history" rows={3} className={`${fieldClass} resize-y`}
      placeholder="Have you volunteered with us or elsewhere before? Tell us about it." />
  </label>
  <label className={labelClass}>
    Donor References (optional)
    <textarea name="references" rows={2} className={`${fieldClass} resize-y`}
      placeholder="Name and contact info for any donors who can vouch for you" />
  </label>
  ```
- `handleSubmit` adds `volunteering_history` / `references` to the payload
  when `mode === "volunteer"`, same pattern as the existing
  `packets_per_trip` / `availability` fields.
- Submit button label for volunteer mode changes from "Register As A
  Volunteer" to **"Submit Volunteer Application"** (mirrors donor mode's
  "Submit Donor Application" — accurate now that it's not instant).
- The post-submit disclaimer ("This is an application, not an instant
  sign-up...") now renders for **both** modes, not just donor — text stays
  the same for donor, and reads "This is an application, not an instant
  sign-up — new volunteers are reviewed before being linked to your
  account." for volunteer mode.
- The "done" state's headline collapses to "Application received!" for
  both modes (previously volunteer mode showed "You're in! Thank you.",
  which is no longer accurate); the existing subtext ("The founder will
  personally follow up with next steps.") already fits both.

### `components/AdminSignoff.tsx`
- Tab label changes from "Donor Applications" to **"Applications"**
  (covers both modes now); heading changes from "Pending Donor
  Applications" to "Pending Applications".
- Each card in `PendingApplications` gains a mode badge (`Donor` /
  `Volunteer`) next to the name, and renders mode-specific fields
  conditionally:
  - `a.mode === "volunteer"`: packets per trip, availability, prior
    volunteering experience, donor references (in place of the
    donor-only packet count / delivery role / partner charity / donor
    story fields).
  - `a.mode === "donor"`: unchanged from today.
  - `notes` (shared) stays as-is at the bottom of the card.

### `lib/types.ts`
- `SignupPayload` gains `volunteering_history?: string; references?: string;`
  (volunteer-mode-only, same treatment as `packets_per_trip`/`availability`).
- `SignupAdminView` gains `packets_per_trip?: number; availability?: string;
  volunteering_history?: string; references?: string;`.

### `lib/api.ts`
No change — `submitSignup`/`listPendingSignups`/`approveSignup`/
`rejectSignup` are all already generic over the payload/view shape.

## Infra
No schema change — DynamoDB is schemaless beyond declared key attributes
and GSI hash/range keys, so the two new `SignupRequest` fields
(`volunteering_history`, `references`) need no Terraform changes; the
`signups` table's existing `status`/`status-index` already carries
volunteer entries once `create_signup` sets `status` unconditionally (see
above). One doc-only fix: `infra/modules/data/main.tf`'s comment on the
`signups` table's `status-index` currently says "Donor entries only... —
volunteer entries have no status and aren't returned by this index," which
this change makes inaccurate; update it to say the index now covers both
modes.

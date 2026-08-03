# Feature: Donor Application Approval — Design

## Backend

### Models (`app/models/domain.py`)
- `SignupStatus = Literal["requested_signoff", "approved", "rejected"]`.
- `SignupRequest` gains `email: str | None = None` (resolved by the router,
  not validated in the model itself — see [[../002-join-in-signup/design]]).
- `SignupAdminView(CamelModel)` — mirrors `SubmissionAdminView`: `signup_id,
  mode, name, email, location, notes, packet_count, delivery_role,
  partner_charity, donor_story, status, created_at`.
- `AuthUser` gains `is_admin: bool` — computed server-side (same
  `ADMIN_EMAILS` check as `deps.require_admin`) wherever an `AuthUser` is
  returned (`/api/auth/google`, `/facebook`, `/me`, and the new `/dummy`),
  so the frontend can show/hide the Admin nav link without a failed-request
  round trip.
- `DummyLoginRequest(BaseModel)`: `{ username: str, password: str }`.

### `app/services/email.py` (new)
Same `local`/`dynamodb`-keyed split as `store.py`/`blob.py`:
```python
class EmailSender(Protocol):
    def send_donor_onboarded(self, to_email: str, name: str) -> None: ...

def get_email_sender() -> EmailSender: ...  # keyed off DATA_BACKEND
```
- `LocalEmailSender` — logs `f"[email] would send onboarding email to
  {to_email} ({name})"` to the console. No AWS needed for local dev.
- `SesEmailSender` — `boto3.client("ses").send_email(...)`, `Source` =
  `os.environ["SES_FROM_EMAIL"]`, simple subject/body ("You've been
  onboarded as a donor at {charity_name}! ..."). If `SES_FROM_EMAIL` isn't
  set in a deployed env, raise clearly at first use rather than silently
  no-op — better to fail loudly than have approvals silently not notify.

### Donor resolution — from "find-or-create" to "find-or-claim-or-deny"
`local_store.py`/`dynamo_store.py`'s `_donor_id_for_user(user_id)` (used by
`create_submission`) changes:
```python
def _donor_id_for_user(self, user_id: str) -> str:
    # 1. already linked?
    for d in self._donors.values():
        if d.get("user_id") == user_id:
            return d["id"]
    # 2. claim an unclaimed donor by matching this user's session email
    user = self._users.get(user_id)
    email = user.get("email") if user else None
    if email:
        for d in self._donors.values():
            if d.get("email") == email and not d.get("user_id"):
                d["user_id"] = user_id  # claim it
                return d["id"]
    # 3. no match — the caller must treat this as "not an approved donor"
    raise DonorNotApprovedError()
```
(DynamoDB version: step 1 via the existing `user-index` GSI query, step 2
via the new `email-index` GSI query + `update_item` to set `user_id`.)

`DonorNotApprovedError` is a new exception in `app/services/store.py`.
`app/routers/uploads.py` (`presign_upload`) and `submissions.py`
(`create_submission`) catch it and raise
`HTTPException(403, "You need an approved donor application before
submitting proof — see the Join In section.")`.

### Signup admin endpoints (`app/routers/admin.py`)
- `GET /api/admin/signups?status=requested_signoff` (default) — admin only,
  `Store.list_signups(status)`.
- `POST /api/admin/signups/{id}/approve` — admin only:
  1. `Store.approve_signup(signup_id)` — marks the signup `approved`,
     creates an unclaimed `Donors` row (`name`, `location`, `story` =
     `donor_story`, `email`, `total_meals: 0`, `donation_count: 0`,
     `user_id` unset), returns `(name, email)`.
  2. `get_email_sender().send_donor_onboarded(email, name)`.
- `POST /api/admin/signups/{id}/reject` — admin only,
  `Store.reject_signup(signup_id)` (status flip only, same shape as
  `reject_submission`).

### `Store` protocol additions (`app/services/store.py`)
`list_signups(status)`, `approve_signup(signup_id) -> tuple[str, str]`
(name, email), `reject_signup(signup_id)`.

### Local admin login (`app/routers/auth.py`) — superseded
**Updated 2026-08-03**: this endpoint's exact contract (credentials, and
whether it only ever logs in as admin) is superseded by
[[../008-persona-dashboards-and-roles/design]], which adds a `role` param
and changes the credentials to `dummy_user`/`dummy_password`. The
mechanism below (gated behind `ENABLE_DUMMY_LOGIN`, 404 when disabled) is
still accurate for the `role == "admin"` case specifically.
```python
@router.post("/dummy", response_model=AuthUser)
def sign_in_dummy(body: DummyLoginRequest, response: Response) -> AuthUser:
    if os.environ.get("ENABLE_DUMMY_LOGIN") != "true":
        raise HTTPException(status_code=404)
    if body.username != "dummy" or body.password != "dummy":
        raise HTTPException(status_code=401, detail="Invalid credentials")
    admin_emails = [e.strip() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
    if not admin_emails:
        raise HTTPException(status_code=500, detail="ADMIN_EMAILS is not configured")
    email = admin_emails[0]
    user_id, name = get_store().get_or_create_user("dummy", "dummy-admin", email, "Local Admin")
    _set_session_cookie(response, issue_session_token(user_id, name, email, "dummy"))
    return AuthUser(name=name, email=email, provider="dummy", is_admin=True)
```
`AuthUser.provider` widens to `Literal["google", "facebook", "dummy"]`.
`404` (not `403`) when the flag is off, so the endpoint's mere existence
isn't detectable/probable from outside local dev.

## Frontend

### `components/AdminSignoff.tsx` (new)
Hash-routed at `#admin` (`app/page.tsx`'s `view` union extends to include
`"admin"`). Three states:
1. **Not signed in / not admin**: the normal Google/Facebook sign-in
   buttons (reuses the same `lib/auth.ts` helpers as `SignInModal`), plus —
   only when `NEXT_PUBLIC_ENABLE_DUMMY_LOGIN === "true"` — a small
   username/password form posting to `/api/auth/dummy` via a new
   `api.signInDummy(username, password)`.
2. **Signed in, not admin**: "You don't have admin access."
3. **Signed in as admin**: fetch `GET /api/admin/signups`, render a card per
   application (name, email, location, packet count, delivery role,
   partner charity, donor story, notes, submitted date) with Approve/Reject
   buttons; on click, call the endpoint and remove that card from the list
   (optimistic — no need to refetch the whole list).

### `Header.tsx`
New "Admin" nav link, rendered only when `user?.isAdmin`, `href="#admin"`.

### `Gallery.tsx`
The upload-submit error handler special-cases a `403` response: instead of
the generic "something went wrong" message, show "You need an approved
donor application before submitting proof — apply via Join In" with a link
to `#participate`.

### `lib/types.ts` / `lib/api.ts`
- `AuthUser` gains `isAdmin: boolean`.
- New `SignupAdminView` type mirroring the backend model.
- `api.listPendingSignups()`, `api.approveSignup(id)`,
  `api.rejectSignup(id)`, `api.signInDummy(username, password)`.
- `SignupPayload` gains `email?: string`.

## Infra
- `infra/modules/data`: `Donors` gains `email` attribute + `email-index`
  GSI; `Signups` gains `status` attribute + `status-index` GSI (mirrors
  `Submissions`' existing `status-index`).
- `infra/modules/api`: new IAM statement, `ses:SendEmail`/
  `ses:SendRawEmail` scoped to the SES identity ARN (passed in as a
  variable); new env vars `SES_FROM_EMAIL`, and (documented, never set by
  Terraform) `ENABLE_DUMMY_LOGIN`.
- `infra/envs/{dev,prod}`: new `var.ses_from_email` (default `""`),
  conditional `aws_ses_email_identity` resource (only created when set —
  same optional-resource pattern as `modules/dns`), its ARN passed into
  `modules/api`.

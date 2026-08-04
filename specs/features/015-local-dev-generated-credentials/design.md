# Feature: Generated Per-Applicant Local-Dev Credentials — Design

## Backend

### Models (`app/models/domain.py`)
```python
class DonorMe(Donor):
    """GET /api/donors/me only — the public Donor model (also used by
    GET /api/donors/{id}) deliberately never carries this. Keeping it a
    separate response model, not a field on Donor, means there is no
    code path where the public route could ever return it."""
    local_username: str | None = None

class VolunteerMe(Volunteer):
    """Same idea as DonorMe, for GET /api/volunteers/me — distinct from
    the public Volunteer/VolunteerSummary models."""
    local_username: str | None = None
```
`DummyLoginRequest` drops `role` entirely:
```python
class DummyLoginRequest(BaseModel):
    username: str
    password: str
```

### `local_username` generation (`local_store.py` / `dynamo_store.py`)
A shared helper (module-level function, used by `approve_signup` in both
stores):
```python
def _generate_local_username(name: str, taken: set[str]) -> str:
    base = re.sub(r"[^a-z0-9_]", "", name.strip().lower().replace(" ", "_")) or "user"
    username = base
    n = 2
    while username in taken:
        username = f"{base}{n}"
        n += 1
    return username
```
`approve_signup` computes `taken` from every existing Donor + Volunteer
`local_username` (local: a set comprehension over `self._donors`/
`self._volunteers`; DynamoDB: two scans projecting just `local_username`
— small tables, same cost class as the scans `get_content()` already
does) and stores the result as `local_username` on the new Donor/Volunteer
record, unconditionally (harmless metadata even in a deployed env — see
"Access control," below, for why it can't be *used* there regardless).

### `Store` protocol additions
```python
def get_donor_local_username(self, donor_id: str) -> str | None: ...
def get_volunteer_local_username(self, volunteer_id: str) -> str | None: ...
def resolve_local_login(self, username: str) -> tuple[str, str] | None:
    """(email, name) for whichever Donor or Volunteer has this generated
    local_username, else None. The router signs the match in through the
    normal get_or_create_user + resolve_donor_id/resolve_volunteer_id
    claim-by-email path — same mechanism a real OAuth sign-in uses, so
    is_donor/is_volunteer resolve correctly with no special-casing."""
    ...
```
`provision_dummy_donor`/`provision_dummy_volunteer` are removed (no
longer called from anywhere — see "Access control" below).

### `app/routers/auth.py` — `POST /api/auth/dummy`
```python
@router.post("/dummy", response_model=AuthUser)
def sign_in_dummy(body: DummyLoginRequest, response: Response) -> AuthUser:
    if os.environ.get("ENABLE_DUMMY_LOGIN") != "true":
        raise HTTPException(status_code=404)
    if body.password != "dummy_password":
        raise HTTPException(status_code=401, detail="Invalid credentials")

    store = get_store()
    if body.username == "dummy_user":
        admin_emails = [...]  # unchanged from today
        if not admin_emails:
            raise HTTPException(500, "ADMIN_EMAILS is not configured")
        email, name, subject = admin_emails[0], "Local Admin", "dummy-admin"
    else:
        match = store.resolve_local_login(body.username)
        if match is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        email, name = match
        subject = f"dummy-local-{body.username}"

    user_id, name = store.get_or_create_user("dummy", subject, email, name)
    _set_session_cookie(response, issue_session_token(user_id, name, email, "dummy"))
    return _auth_user_with_roles(user_id, name, email, "dummy")
```
`dummy_user` stays a reserved username (matches the fixed admin
credential from before this change); every other username is looked up
as a generated applicant username. `404` (not `403`) when disabled is
unchanged — same "don't leak that this exists" rationale as before.

### `app/routers/donors.py` / `volunteers.py`
`GET /api/donors/me` / `GET /api/volunteers/me` change
`response_model` to `DonorMe`/`VolunteerMe` and attach the looked-up
username:
```python
donor = get_store().get_donor(donor_id)
...
local_username = get_store().get_donor_local_username(donor_id)
return DonorMe(**donor.model_dump(), local_username=local_username)
```
`GET /api/donors/{donor_id}` (public) and `GET /api/volunteers` (donor-
facing directory) are untouched — still `Donor`/`VolunteerSummary`,
which have no `local_username` field to leak.

### Access control
`local_username` is generated unconditionally at approval time (harmless
metadata) but can only ever be *used* to sign in through
`POST /api/auth/dummy`, which is itself gated behind
`ENABLE_DUMMY_LOGIN=true` — an env var Terraform never sets (see
[[../../00-constitution]] §4). A deployed environment has a
`local_username` sitting unused on every Donor/Volunteer row and no way
to reach it.

## Frontend

### `lib/types.ts`
`Donor` and `Volunteer` both gain `localUsername?: string` (present only
on the `/me` responses in practice; `undefined` elsewhere, which is fine
— purely structural typing, the backend model split above is the actual
security boundary).

### `lib/api.ts`
`signInDummy(username: string, password: string)` — drops the `role`
parameter.

### `components/SignInModal.tsx`
The role-picker row (Admin/Donor/Volunteer buttons) is removed. The
dummy-login form is just Username + Password + "Dummy Login", with
updated helper copy: "Local dev only — sign in as admin (`dummy_user`) or
as an approved donor/volunteer using the username shown on their
dashboard."

### `components/DonorDashboard.tsx` / `VolunteerDashboard.tsx`
Both gain a small block, shown only when
`NEXT_PUBLIC_ENABLE_DUMMY_LOGIN === "true"` **and** the fetched profile
has a `localUsername`:
```tsx
{DUMMY_LOGIN_ENABLED && donor.localUsername && (
  <div className="mb-8 rounded-2xl border border-dashed border-border-strong bg-card p-5">
    <p className="m-0 mb-2 text-xs font-bold text-muted-2 uppercase">Local dev login</p>
    <p className="m-0 text-sm">username: <code>{donor.localUsername}</code></p>
    <p className="m-0 text-sm">password: <code>dummy_password</code></p>
  </div>
)}
```

## Tests
- Backend (`backend/tests/test_local_dev_credentials.py`, pytest):
  approving a donor/volunteer application generates a `local_username`
  from the applicant's name; two applicants with the same name get
  distinct, suffixed usernames; `POST /api/auth/dummy` with a generated
  username + `dummy_password` signs in as that donor/volunteer
  (`isDonor`/`isVolunteer` true, `GET /api/donors/me` /
  `GET /api/volunteers/me` return the matching `localUsername`); a wrong
  password or unknown username still gets `401`; the admin path
  (`dummy_user`) is unaffected.
- Frontend (`frontend/e2e/local-dev-credentials.spec.ts`, Playwright):
  confirm the Sign In modal no longer shows Donor/Volunteer role
  buttons; approve a volunteer application as admin (via the UI), sign
  in as that volunteer using the generated username (`name`, spaces to
  underscores) + `dummy_password`, confirm sign-in succeeds and "My
  Volunteering" shows a "Local dev login" block with that same username.

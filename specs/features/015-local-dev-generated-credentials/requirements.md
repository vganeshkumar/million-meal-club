# Feature: Generated Per-Applicant Local-Dev Credentials

## Why
Bug/change reported by the user (2026-08-03): the local-dev-only dummy
login (see [[../008-persona-dashboards-and-roles/requirements]]) has a
single hardcoded synthetic Donor and a single hardcoded synthetic
Volunteer, auto-provisioned on first use. That's fine for a quick preview
of the dashboards, but it can't be used to test *your own* just-approved
applicant — there's no way to sign in and see the real record a specific
Join In application turned into. The founder wants real per-applicant
local credentials instead: generated automatically the moment an
application is approved, and visible to that person afterward as a login
they can actually use.

## Requirements

### Username/password generation
The moment `POST /api/admin/signups/{id}/approve` creates a Donor or
Volunteer record (see
[[../007-donor-application-approval/design]]/[[../011-volunteer-application-approval/design]]),
it also generates and stores a local-dev username on that record:
the applicant's name, lowercased, spaces replaced with underscores,
anything else stripped to `[a-z0-9_]`. If that username is already taken
by another approved Donor or Volunteer, a numeric suffix is appended
(`jane_smith`, `jane_smith2`, …) until it's unique. The password is not
generated — every generated username shares the same fixed password,
`dummy_password`.

### Replacing the Donor/Volunteer dummy-login shortcuts
The dummy-login form's **Admin** shortcut is unchanged (fixed username
`dummy_user`, password `dummy_password`, logs in as the first
`ADMIN_EMAILS` entry). The **Donor** and **Volunteer** role shortcuts are
removed — there's no more auto-provisioned synthetic sample account.
Instead, the same Username/Password fields log in as **any** approved
donor or volunteer, by their generated username. `dummy_user` stays
reserved for the admin path; any other username is looked up against
generated Donor/Volunteer usernames.

### Signing in with a generated username
Logging in this way goes through the exact same session-issuing and
donor/volunteer-claiming path a real OAuth sign-in would (matching by the
record's email) — so `isDonor`/`isVolunteer`, "My Donations"/"My
Volunteering," and everything else built on `resolve_donor_id`/
`resolve_volunteer_id` work identically to a real sign-in, no special-
casing.

### Surfacing the generated username
An approved donor/volunteer can see their own generated username (and
the fixed password) in a small "Local dev login" block on their own "My
Donations"/"My Volunteering" dashboard — visible only when dummy login is
enabled (`NEXT_PUBLIC_ENABLE_DUMMY_LOGIN === "true"`), never on any
public-facing page (the public donor detail page, the volunteer
directory, etc. never expose it).

## Out of scope
- Any change to real OAuth sign-in.
- Letting the founder or an applicant regenerate/customize the username
  after approval — it's set once, at approval time.
- A "quick preview" synthetic donor/volunteer account for smoke-testing
  the dashboards without going through a real application — removed
  entirely by this change, not replaced with an equivalent shortcut. The
  founder can preview either dashboard by approving any test application
  and using its generated credentials.

# Feature: Persona Dashboards & Roles

## Why
Two problems reported by the user (2026-08-03, in the same conversation
that shipped [[../007-donor-application-approval/requirements]]):

1. **Bug**: there is no way to *reach* the admin sign-in screen. `Header.tsx`
   only shows the "Admin" nav link when `user?.isAdmin` is already `true` —
   but a signed-out visitor has no `user` yet, so the link that would let
   them sign in as admin is hidden until after they're already signed in as
   admin. Chicken-and-egg; the entry point was simply missing.
2. **Scope gap**: the site only really has one real persona today (a
   generic signed-in user who can submit proof for themselves, once
   approved). The user wants three distinct, testable personas:
   - **Admin** — approves donor applications (exists) **and** reviews/
     approves proof-of-delivery submissions (backend exists at
     `/api/admin/submissions`, but has **no frontend screen** — this was
     built and tested via curl only, never given a UI).
   - **Donor** — can see their own past donations and start a new one,
     choosing to deliver it themselves, request a volunteer, or route it
     through a partner charity.
   - **Volunteer** — can RSVP to events, and can submit proof of delivery
     **on behalf of a donor** (this is exactly the "known gap, out of
     scope" called out in [[../../01-architecture]] "Donor approval &
     claiming" — a volunteer delivering for a donor previously had no way
     to submit proof at all).

Local testing needs to exercise all three without real OAuth credentials,
so the existing `dummy`/`dummy` local-only login (see
[[../007-donor-application-approval/design]]) is extended: same credentials
(user asked for `dummy_user`/`dummy_password` specifically — see "Local
testing" below), plus a **role picker** (admin / donor / volunteer) shown
at login time, so one set of credentials can drive any of the three
dashboards.

## Requirements

### Fix: discoverable sign-in for every persona
Replace the hidden "Admin"-only nav link with a design where **any**
visitor can always reach sign-in, and once signed in, sees links only to
the areas their account actually has:
- Signed out: the header's existing "Sign In" button (already always
  visible) is the single entry point for everyone — admin, donor, and
  volunteer alike. The dummy-login form (local dev only) is added *into*
  the existing sign-in modal, not a separate hidden page, so it's
  reachable the same way for every persona.
- Signed in: header shows "Admin" (if `is_admin`), "My Donations" (if
  `is_donor`), "My Volunteering" (if `is_volunteer`) — any subset, since a
  real person could in principle hold more than one role, though the local
  dummy login only ever grants one at a time (see below).

### Roles on the session
`AuthUser` (returned by `/api/auth/me` and all sign-in endpoints) gains
`is_donor: bool` and `is_volunteer: bool` alongside the existing
`is_admin: bool` — computed server-side (does this session resolve to a
linked `Donors` / `Volunteers` row?), not stored as a single exclusive
"role" field, since the three aren't mutually exclusive for a real account.

### Admin: proof-of-delivery review screen (new frontend, existing backend)
A screen (part of the existing `#admin` area) listing pending submissions
(`GET /api/admin/submissions?status=pending`) with their photo/receipt
(presigned URLs, already returned by the backend), Approve/Reject actions
— same interaction pattern as the existing donor-application review list,
just a second tab/section for a different queue.

### Donor: "My Donations" dashboard (new)
New page, reachable once signed in as a linked donor: their own stats
(total meals, donation count), story, and full delivery history — same
data/visual treatment as the existing public donor detail page, just
scoped to "me" instead of any donor by ID. Plus a way to start a **new**
donation, choosing (same three options as the original application):
deliver it themselves, request a volunteer, or route it through a partner
charity — see "Open question" below for how this is scoped.

### Volunteer: "My Volunteering" dashboard (new)
New page, reachable once signed in as a registered volunteer:
- Their profile (packets-per-trip, availability from their original
  signup).
- The upcoming events list, each with an RSVP toggle — volunteers can now
  actually register attendance per event, not just see the list.
- A "Submit Proof For A Donor" form — the same photo/receipt upload flow
  as the existing Gallery form, plus a donor picker, so a volunteer
  delivering on behalf of a donor can submit proof attributed to that
  donor's total instead of needing a donor account of their own. This
  directly resolves the gap called out in
  [[../../01-architecture]] "Donor approval & claiming".

### Volunteers become a real, linked entity
Today, a volunteer signup is a fire-and-forget form entry — no account
link, no way to later "be" that volunteer when signing in. This changes:
volunteer-mode signups now also require an email (mirroring the donor
flow), and — **unlike donors** — a `Volunteers` record is created
immediately at signup (no approval gate; matches today's "volunteers just
register" behavior), unclaimed until the same email signs in later and
claims it (identical mechanism to donor claiming).

### Local testing: single dummy login, role picker
- Credentials: **`dummy_user`** / **`dummy_password`** (the user specified
  these exact values, replacing the previous `dummy`/`dummy` — see
  [[../007-donor-application-approval/design]]'s original endpoint, which
  this supersedes).
- The login form additionally asks the tester to pick a role: **Admin**,
  **Donor**, or **Volunteer**. Submitting logs in as a synthetic identity
  scoped to that role only:
  - Admin → same as before (the first `ADMIN_EMAILS` entry).
  - Donor → a fixed synthetic donor identity, auto-provisioned as an
    **already-approved, already-claimed** donor (with one sample donation)
    the first time it's used, so "My Donations" has something to show
    immediately without needing to run the full apply → admin-approve loop
    first. (The real apply → approve loop is still separately testable via
    the Admin role + the real Join In form — this shortcut is purely for
    quickly previewing the Donor dashboard.)
  - Volunteer → same idea: a fixed synthetic, already-linked volunteer
    identity, auto-provisioned on first use.
- Still gated behind `ENABLE_DUMMY_LOGIN=true` (backend) /
  `NEXT_PUBLIC_ENABLE_DUMMY_LOGIN=true` (frontend), never set in a
  deployed env — see [[../../00-constitution]] §4, unchanged.

## Open question / assumption flagged for confirmation
**"Register for new donations"** is ambiguous between two designs, and I'm
recommending the simpler one — flagging it explicitly rather than guessing
silently:
- **Recommended**: it's not a separate pre-registration step at all. The
  existing proof-submission form (Gallery, and the new volunteer-on-behalf-
  of form) gains the same delivery-method choice as the original
  application (self / volunteer needed / partner charity) as fields on the
  submission itself — i.e. "registering a new donation" *is* submitting
  proof of it, described more richly. No new entity, reuses the existing
  approval pipeline exactly as-is.
- **Alternative** (not recommended, larger scope): a donor can log a future
  *intent* ("I'm doing 200 packets next week, self-delivered") as its own
  record before any delivery happens or proof exists — effectively a
  lightweight repeat of the Signups/application flow for already-approved
  donors. This would need a new entity and its own admin-visibility story,
  for a benefit that's unclear (the founder already learns about a
  delivery when proof is submitted).

Proceeding with the recommended interpretation unless told otherwise.

## Out of scope
- Enforcing that a volunteer only submits on behalf of a donor who
  actually requested one (`delivery_role: "volunteer_needed"`) — any
  volunteer can submit for any known donor; the founder's existing manual
  photo/receipt review is the backstop against misuse.
- Any UI for the founder to see event RSVP headcounts (the data model
  supports it via a GSI, but no screen is built for it now).
- Removing/renaming the original `dummy`/`dummy` credentials from any
  already-written docs' *history* — this spec changes them going forward
  to `dummy_user`/`dummy_password` per the user's explicit request.

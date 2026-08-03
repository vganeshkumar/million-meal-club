# Feature: Donor Application Approval

## Why
[[../002-join-in-signup/requirements]] captures a donor application but
originally left review as a purely manual, off-system process (the founder
reading the `Signups` table by hand). The founder wants a real loop: capture
name **and email**, track status, review via an actual admin page, and have
approval mean something concrete — the donor's real record gets created and
they receive an onboarding email. Decided with the user 2026-08-03,
alongside making proof-of-delivery submission require an approved, linked
donor (see [[../../01-architecture]] "Donor approval & claiming").

## Requirements

### Capture
- Donor mode of the Join In form now collects **email** in addition to name
  (from the session if signed in, otherwise a required form field) — see
  [[../002-join-in-signup/design]].
- Every donor application is stored with `status: "requested_signoff"`.

### Admin review page
- New page, `/#admin`, linked from the header nav (shown only to signed-in
  admins).
- Lists all `requested_signoff` donor applications: name, email, location,
  donor story, packet count, delivery role, partner charity (if any),
  notes, submitted date.
- Each has **Approve** and **Reject** actions.
- Reachable the same way the rest of the admin surface is reached today —
  sign in with a Google/Facebook account in `ADMIN_EMAILS` — **plus** a
  local-only `dummy`/`dummy` login (see "Local testing" below) so the founder
  can exercise this without real OAuth credentials provisioned yet (still
  blocked on [[../001-oauth-login/requirements]]'s open questions).

### Approval
- Marks the signup `approved`.
- Creates the donor's real `Donors` record immediately — using the
  application's name, location, and donor story — rather than the previous
  behavior of a blank record auto-created on first submission.
- Sends an email to the applicant confirming they've been onboarded.

### Rejection
- Marks the signup `rejected`. No email, no donor record. (Not asked for;
  can be added later.)

### Signing in as the approved donor
The applicant didn't create any account at application time — they only
signed in (or will sign in) via Google/Facebook, same as anyone else. Once
approved, the **next time they sign in via OAuth with the same email** they
applied with, the system recognizes them as that approved donor (see
[[../../01-architecture]] "Donor approval & claiming" for the exact
mechanism) — no separate name/email login exists; OAuth remains the only
way to authenticate, per [[../../00-constitution]] §4.

### Access control change
Submitting proof-of-delivery (`POST /api/uploads/presign`,
`POST /api/submissions`) now requires being linked to an approved donor.
A signed-in user who has never applied, or whose application hasn't been
approved, gets `403` with a message pointing at the Join In form. This is a
real behavior change from today (any signed-in user can currently submit) —
explicitly chosen by the user over "leave submissions open, approval is
purely informational."

### Local testing
`POST /api/auth/dummy` accepts a hardcoded `dummy`/`dummy` username/password
and logs in as an admin (using the first `ADMIN_EMAILS` entry), so the
approval page and flow are testable without provisioning real OAuth
credentials. **Must never work outside local dev** — gated behind
`ENABLE_DUMMY_LOGIN=true`, an env var Terraform never sets. See
[[../../00-constitution]] §4 for why this is a deliberately narrow,
called-out exception rather than a quiet violation.

## Out of scope
- Any UI/endpoint for the founder to edit an already-approved donor's
  story/location after the fact (they can still edit the `Donors` table
  directly, same gap as `Events`/`PartnerCharities`).
- A rejection email.
- Solving how a volunteer delivering *on behalf of* a donor submits proof —
  known gap, see [[../../01-architecture]].
- Tracking the 50,000-meal/4-year commitment programmatically (unchanged
  from [[../002-join-in-signup/requirements]] — still just a one-time
  checkbox).

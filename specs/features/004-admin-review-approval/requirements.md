# Feature: Admin Review & Approval

## Why
The trust/verification step: nothing public changes until the founder
explicitly says so. See [[00-constitution]] §5.

## Requirements
- Admin access is the founder's normal Google/Facebook login, gated by an
  `ADMIN_EMAILS` server-side allowlist — no separate admin credential.
- Founder can list pending submissions with enough info to judge them
  (photo, receipt if provided, location, meal count, submitter name/caption).
- Approve action: moves the photo to public storage, updates the donor's
  and site's meal totals, marks the submission approved — all as one
  reviewed action, never automatic.
- Reject action: marks the submission rejected; no public data changes.
- Founder can edit site config (current meal total, milestones, founder
  name, charity name, accent palette) directly, without a code deploy —
  for corrections or manual reconciliation.

## Out of scope (for now)
- A dedicated admin UI in the frontend (v1 ships as API endpoints only —
  the founder can call them via a simple internal tool, `curl`/Postman, or
  a minimal unstyled admin page added later as its own feature spec if
  wanted).

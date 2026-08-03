# Backend — Requirements

## Purpose
Provide the real data/auth/upload/approval backend the design prototype
stubs out, as a single FastAPI service, deployable serverlessly with zero
idle cost. See [[00-constitution]] §2 and §3.

## Functional requirements
- `GET /api/content` — public. Returns everything the home page needs from a
  real data source in one call: `config` (charity name, founder name, meal
  totals, milestones, accent palette), `donors` (sorted by total meals
  descending), `events`, `partnerCharities`, `gallery` (approved photo
  refs). FAQ copy is *not* part of this response — it's static frontend
  content (see [[../frontend/design]] "Static content"), matching the
  design's treatment of it as already-final copy rather than placeholder
  data.
- `GET /api/donors/{donor_id}` — public. Donor detail + their approved
  donations list.
- `GET /api/donors/me`, `GET /api/volunteers/me` — auth required. The
  signed-in user's own linked donor/volunteer record; `404` if not (yet)
  linked to one. See [[008-persona-dashboards-and-roles]].
- `POST`/`DELETE /api/events/{event_id}/rsvp` — auth required, and the
  user must resolve to a linked volunteer (`403` otherwise). See
  [[008-persona-dashboards-and-roles]].
- `POST /api/auth/google`, `POST /api/auth/facebook` — verify provider
  token, upsert `Users` row, set session cookie. See [[001-oauth-login]].
- `GET /api/auth/me` — returns current session user or 401.
- `POST /api/auth/logout` — clears session cookie.
- `POST /api/signups` — Join In form: donor application (invitation-only —
  story + two consent checkboxes required, optional partner-charity
  choice) or volunteer registration. Auth optional; attaches `user_id` if
  signed in. Requires `country` (both modes) alongside `location` — see
  [[002-join-in-signup]] and [[010-country-field-for-matching]].
- `POST /api/uploads/presign`, `POST /api/submissions` — auth required
  **and** the signed-in user must be linked to an approved donor (see
  [[007-donor-application-approval]]) — `403` otherwise, **unless**
  submitting on behalf of a donor as a linked volunteer (`donor_id` in the
  body — see [[008-persona-dashboards-and-roles]]), in which case the
  submitter must instead resolve to a linked volunteer. Presign returns a
  presigned S3 PUT URL scoped to `pending/{submission_id}/...`,
  content-type/size validated; submissions creates a pending
  proof-of-delivery record referencing an uploaded photo key. See
  [[003-photo-proof-submission]].
- `GET /api/admin/submissions?status=pending` — admin only. Lists pending
  submissions with presigned GET URLs for review.
- `POST /api/admin/submissions/{id}/approve` — admin only. Copies photo to
  `approved/*`, updates `Donations`/`Donors`/`Config` totals atomically.
- `POST /api/admin/submissions/{id}/reject` — admin only.
- `GET /api/admin/signups?status=requested_signoff`,
  `POST /api/admin/signups/{id}/approve`,
  `POST /api/admin/signups/{id}/reject` — admin only, donor application
  review. Approve creates the donor's real record and sends an onboarding
  email. See [[007-donor-application-approval]].
- `POST /api/admin/config` — admin only. Edits `Config` (meal totals,
  milestones, etc.) without a code deploy.
- `GET /api/volunteers` — auth required, donor only (`403` otherwise).
  Directory of registered volunteers for the donation-event assignment
  picker. See [[009-scheduled-donation-events]].
- `POST /api/donation-events`, `GET /api/donation-events/mine`,
  `PATCH /api/donation-events/{id}/volunteer`,
  `GET /api/donation-events/volunteer-assigned` — a donor's pre-scheduled
  deliveries, optionally assigned to a specific volunteer. Submitting proof
  against one (`donation_event_id` on `POST /api/submissions`) attributes
  it to the event's donor regardless of who submits, auto-closes the event
  to further submissions (`409` on a repeat attempt), and reopens it if the
  founder rejects that submission. See
  [[009-scheduled-donation-events]].
- `POST /api/auth/dummy` — **local dev only**, gated behind
  `ENABLE_DUMMY_LOGIN=true` (never set by Terraform). Hardcoded
  `dummy_user`/`dummy_password` login with a role param (admin/donor/
  volunteer), for testing any of the three personas' screens without real
  OAuth credentials. See [[008-persona-dashboards-and-roles]] and
  [[00-constitution]] §4.

## Non-functional requirements
- Runs as a single Lambda function (FastAPI + Mangum), no other compute.
- No password storage of any kind — auth is OAuth-token-verification only.
- Admin routes are gated by an email allowlist (`ADMIN_EMAILS` env var), not
  a separate credential system. See [[00-constitution]] §4.
- All writes that affect public counts (approve/reject) are manual-trigger
  only — never automatic on submission. See [[00-constitution]] §5.
- DynamoDB access uses table-scoped IAM permissions only (no `dynamodb:*`).
- CORS is effectively a non-issue in production (same-origin via CloudFront
  path routing — see [[01-architecture]]) but must still work for local dev
  (`localhost:3000` → `localhost:8000`).

## Out of scope (for now)
- Rate limiting / WAF (fine to add later via API Gateway/CloudFront if abuse
  becomes an issue — not needed for initial launch traffic).
- Email notifications to the founder on new submissions (nice-to-have,
  not required for MVP — founder can poll the admin queue).

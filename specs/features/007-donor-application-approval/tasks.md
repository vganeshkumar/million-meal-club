# Feature: Donor Application Approval — Tasks

- [ ] Backend: `SignupStatus`, `SignupRequest.email`, `SignupAdminView`,
      `AuthUser.is_admin`, `DummyLoginRequest` models.
- [ ] Backend: `app/services/email.py` (`LocalEmailSender`, `SesEmailSender`,
      `get_email_sender()`).
- [ ] Backend: `local_store.py`/`dynamo_store.py` — `list_signups`,
      `approve_signup`, `reject_signup`; `_donor_id_for_user` → claim-or-deny
      (`DonorNotApprovedError`).
- [ ] Backend: `app/routers/signups.py` — resolve email from session or
      body, require it for donor mode, set `status: "requested_signoff"`.
- [ ] Backend: `app/routers/uploads.py` / `submissions.py` — catch
      `DonorNotApprovedError` → `403`.
- [ ] Backend: `app/routers/admin.py` — signup list/approve/reject
      endpoints.
- [ ] Backend: `app/routers/auth.py` — `POST /api/auth/dummy`
      (`ENABLE_DUMMY_LOGIN`-gated), `is_admin` on all auth responses.
- [ ] Infra: `Donors.email` + `email-index`, `Signups.status` +
      `status-index` in `modules/data`.
- [ ] Infra: SES IAM statement + env vars in `modules/api`;
      `aws_ses_email_identity` + `var.ses_from_email` in `envs/{dev,prod}`.
- [ ] Frontend: `lib/types.ts`/`lib/api.ts` additions.
- [ ] Frontend: `JoinInForm.tsx` — Email field in donor mode (signed out).
- [ ] Frontend: `components/AdminSignoff.tsx` (new) — sign-in gate (incl.
      dummy login form, env-flag gated), pending-applications list,
      approve/reject.
- [ ] Frontend: `Header.tsx` — Admin nav link.
- [ ] Frontend: `Gallery.tsx` — tailored message for the new `403`.
- [ ] Frontend: `app/page.tsx` — `"admin"` view + `#admin` hash routing.
- [ ] Manual/curl test: full loop — apply as donor with email → confirm
      `requested_signoff` → dummy-login as admin → list → approve → confirm
      `Donors` row created (unclaimed) + local email sender logged the
      onboarding message → mint a session for that email → submit proof →
      confirm it's claimed, not blocked.
- [ ] Manual/curl test: a different, never-approved signed-in user's
      submission attempt gets `403` with the expected message.
- [ ] Manual test (frontend): `#admin` unauthenticated view, dummy login,
      approve/reject buttons, Gallery's new blocked-submission message.

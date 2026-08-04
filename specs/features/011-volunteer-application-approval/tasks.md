# Feature: Volunteer Application Approval — Tasks

- [ ] Backend: `SignupRequest.volunteering_history`/`.references`;
      `SignupAdminView` gains `packets_per_trip`, `availability`,
      `volunteering_history`, `references`.
- [ ] Backend: `app/services/email.py` — `send_volunteer_onboarded` on
      `EmailSender`/`LocalEmailSender`/`SesEmailSender`.
- [ ] Backend: `local_store.py`/`dynamo_store.py` — `create_signup` sets
      `status: "requested_signoff"` unconditionally (drop the inline
      volunteer-row creation); `approve_signup` branches on `mode` to
      create a `Donors` or `Volunteers` row and returns
      `(name, email, mode)`.
- [ ] Backend: `app/services/store.py` — `approve_signup` return-type/
      docstring updates.
- [ ] Backend: `app/routers/admin.py` — `approve_signup` sends the
      mode-appropriate onboarding email.
- [ ] Infra: `infra/modules/data/main.tf` — fix the now-inaccurate
      `signups.status-index` comment (no resource change).
- [ ] Frontend: `lib/types.ts` — `SignupPayload`/`SignupAdminView`
      additions.
- [ ] Frontend: `JoinInForm.tsx` — volunteering-history/references fields,
      "Submit Volunteer Application" button label, shared post-submit
      disclaimer, unified "Application received!" done state.
- [ ] Frontend: `AdminSignoff.tsx` — "Applications" tab covers both modes,
      mode badge, volunteer-specific fields on the card.
- [ ] Manual/curl test: full loop — apply as volunteer with volunteering
      history + references → confirm `requested_signoff` → admin lists it
      → approve → confirm `Volunteers` row created (unclaimed) + local
      email sender logged the approval message → mint a session for that
      email → `GET /api/volunteers/me` resolves it (claimed) → RSVP to an
      event succeeds.
- [ ] Manual/curl test: reject path — apply as volunteer → reject → confirm
      no `Volunteers` row exists → a session for that email still gets
      `403`/`404` on volunteer-gated endpoints.
- [ ] Manual/curl test: a signed-in user who never applied as a volunteer
      still gets the expected 403/404 on RSVP / submit-on-behalf-of-a-donor
      (unchanged from today, verifying no regression).
- [ ] Manual test (frontend): Join In form in volunteer mode — new fields
      present and optional, submit shows "Application received!"; `#admin`
      Applications tab shows a volunteer card with the new fields,
      Approve/Reject both work.

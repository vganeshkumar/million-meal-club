# Feature: Persona Dashboards & Roles — Tasks

- [ ] Backend: `Volunteers` resolution (`resolve_volunteer_id`), refactor
      `resolve_donor_id` from raising to `Optional`-returning; remove
      `DonorNotApprovedError`.
- [ ] Backend: `create_signup` creates an unclaimed `Volunteers` row
      immediately for `mode == "volunteer"`; volunteer mode now requires
      email (mirrors donor mode).
- [ ] Backend: `GET /api/donors/me`, `GET /api/volunteers/me`.
- [ ] Backend: `POST`/`DELETE /api/events/{event_id}/rsvp`.
- [ ] Backend: `SubmissionRequest` gains `delivery_role`, `partner_charity`,
      `donor_id`; submit-on-behalf-of-a-donor path in `create_submission`.
- [ ] Backend: `AuthUser` gains `is_donor`, `is_volunteer`, computed
      wherever `AuthUser` is returned.
- [ ] Backend: `POST /api/auth/dummy` — credentials become
      `dummy_user`/`dummy_password`, add `role` param, implement the three
      role behaviors (admin unchanged; donor/volunteer auto-provision an
      idempotent synthetic linked identity).
- [ ] Infra: `Volunteers`, `EventSignups` tables + GSIs in `modules/data`;
      `VOLUNTEERS_TABLE`/`EVENT_SIGNUPS_TABLE` env vars in `modules/api`.
- [ ] Frontend: move the dummy-login form (+ role picker) into
      `SignInModal.tsx`; fixes the admin-unreachable bug for every persona,
      not just admin.
- [ ] Frontend: `Header.tsx` — "Admin"/"My Donations"/"My Volunteering"
      links based on `user.isAdmin`/`isDonor`/`isVolunteer`.
- [ ] Frontend: `#admin` gains a "Submissions" tab (new
      `AdminSubmissions.tsx` or a section within `AdminSignoff.tsx`).
- [ ] Frontend: `#my-donations` — `DonorDashboard.tsx`.
- [ ] Frontend: `#my-volunteering` — `VolunteerDashboard.tsx` (profile,
      event RSVP toggles, submit-proof-for-a-donor form).
- [ ] Frontend: `Gallery.tsx` gains `delivery_role`/`partner_charity`
      fields.
- [ ] Frontend: `app/page.tsx` routing extended to `"my-donations"` /
      `"my-volunteering"`.
- [ ] Manual/curl test: volunteer signup with email → creates unclaimed
      `Volunteers` row → dummy-login as volunteer (or mint a session for
      that email) → `GET /api/volunteers/me` resolves it.
- [ ] Manual/curl test: RSVP to an event, confirm it appears in
      `GET /api/volunteers/me`, confirm cancel removes it.
- [ ] Manual/curl test: volunteer submits proof with `donor_id` set for a
      *different* donor than themselves → confirm it lands on that donor's
      record on approval, not the volunteer's own.
- [ ] Manual/curl test: dummy login as each of the three roles, confirm
      each only unlocks its own dashboard (donor role can't reach
      `/api/admin/*`, etc.) and that repeat dummy-donor/volunteer logins
      reuse the same synthetic identity rather than creating duplicates.
- [ ] Manual test (frontend): Sign In modal shows the role picker locally;
      each role lands on the right dashboard; admin sees both
      Applications and Submissions tabs; Gallery's new fields render;
      donor dropdown in the volunteer's submit-for-a-donor form is
      populated.

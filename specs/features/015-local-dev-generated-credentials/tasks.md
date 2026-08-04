# Feature: Generated Per-Applicant Local-Dev Credentials — Tasks

- [ ] Backend: `DonorMe`/`VolunteerMe` models; `DummyLoginRequest` drops
      `role`.
- [ ] Backend: `local_store.py`/`dynamo_store.py` — `_generate_local_username`
      helper; `approve_signup` sets `local_username` on the new Donor/
      Volunteer row; `get_donor_local_username`, `get_volunteer_local_username`,
      `resolve_local_login`; remove `provision_dummy_donor`/
      `provision_dummy_volunteer`.
- [ ] Backend: `app/routers/auth.py` — `/auth/dummy` drops the role
      branch, resolves `dummy_user` → admin, anything else →
      `resolve_local_login`.
- [ ] Backend: `app/routers/donors.py` / `volunteers.py` — `/me` routes
      return `DonorMe`/`VolunteerMe` with `local_username` attached.
- [ ] Frontend: `lib/types.ts` — `Donor`/`Volunteer` gain `localUsername?`;
      `lib/api.ts` — `signInDummy` drops the `role` param.
- [ ] Frontend: `SignInModal.tsx` — remove the role-picker row, update
      helper copy.
- [ ] Frontend: `DonorDashboard.tsx` / `VolunteerDashboard.tsx` — "Local
      dev login" block.
- [ ] Backend tests (`backend/tests/test_local_dev_credentials.py`):
      generation, collision suffixing, sign-in success/failure, admin
      path unaffected.
- [ ] Frontend test (`frontend/e2e/local-dev-credentials.spec.ts`): role
      buttons gone; approve → generated username → sign in → dashboard
      shows the login block.

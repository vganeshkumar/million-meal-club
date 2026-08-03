# Feature: Country Field for Matching — Tasks

- [ ] Backend: `SignupRequest`, `Donor`, `Volunteer`, `VolunteerSummary`,
      `SignupAdminView` gain `country: str`.
- [ ] Backend: `local_store.py`/`dynamo_store.py` — persist `country` on
      signup (both modes), copy onto `Donors` at approval, default
      `country` on seed data / dummy provisioning, defensive `""` fallback
      on read for pre-existing rows.
- [ ] Frontend: new `lib/countries.ts`; `lib/types.ts` gains `country` on
      `Donor`/`Volunteer`/`VolunteerSummary`/`SignupPayload`/
      `SignupAdminView`.
- [ ] Frontend: `JoinInForm.tsx` — Country `<select>`, both modes,
      unconditional on sign-in state.
- [ ] Frontend: `DonorDashboard.tsx` — show country; volunteer-assignment
      pickers show country and sort same-country volunteers first.
- [ ] Frontend: `VolunteerDashboard.tsx` — show country.
- [ ] Frontend: `AdminSignoff.tsx` — show country on pending applications.
- [ ] Manual/curl test: donor signup with country → approve → `Donor.country`
      matches.
- [ ] Manual/curl test: volunteer signup with country → `GET /api/volunteers`
      (donor directory) shows it.
- [ ] `npm run build`/`lint` clean; backend still imports.

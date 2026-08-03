# Feature: Join In Signup — Tasks

- [x] Backend: pydantic `SignupRequest` discriminated union model
      (original open-donor version).
- [x] Backend: `deps.get_current_user_optional()`.
- [x] Backend: `app/routers/signups.py` — `POST /api/signups`.
- [x] Backend: `Signups` table access in `dynamo.py`.
- [ ] Backend: extend `SignupRequest` with `partner_charity`, `donor_story`,
      `commit_50k_4yr`, `agree_publish_story`; enforce the two checkboxes
      must be `True` when `mode == 'donor'` (invitation-only model).
- [x] Frontend: `JoinInForm.tsx` posting to `/api/signups` (original
      open-donor version).
- [ ] Frontend: update `JoinInForm.tsx` to the invitation-only donor
      application — info banner, partner-charity select, donor story
      textarea, two consent checkboxes, "Submit Donor Application" label,
      disclaimer line.
- [x] Frontend: signed-in "Signed in as {name}" chip + signed-out Name input.
- [ ] Manual test: submit a donor application (signed-out and signed-in)
      with the new fields; verify validation rejects it if either checkbox
      is unchecked or the story is empty; verify a volunteer submission is
      unaffected.

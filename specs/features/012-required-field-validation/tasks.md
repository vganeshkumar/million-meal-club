# Feature: Required-Field Validation on Join In Submit — Tasks

- [x] Backend: `SignupRequest._validate_required_fields` — donor mode
      requires `packet_count` and (`delivery_role` OR `partner_charity`,
      as a pair — see 2026-08-04 correction below) in addition to the
      existing `donor_story`/checkboxes; volunteer mode requires
      `packets_per_trip`/`availability`.
- [x] Frontend: `JoinInForm.tsx` — `required` on the newly-required
      inputs; reactive `checkValidity()`-driven submit-button disable,
      recomputed on field change and on `[mode, user]` change.
- [x] Backend tests (`backend/tests/test_signups.py`): valid/invalid
      payloads per mode covering every required field, both old and new.
- [x] Frontend test (`frontend/e2e/required-field-validation.spec.ts`):
      submit button disabled/enabled transitions in both modes; optional
      fields never block submission.
- [x] **Correction, 2026-08-04**: `delivery_role` was initially made
      unconditionally required, blocking a donor who only wanted to name
      a partner charity. Fixed to an OR-group (`delivery_role` and
      `partner_charity` — at least one required, not both) across
      backend validator, frontend `JoinInForm.tsx` (custom cross-field
      check via `FormData`, since native `required` can't express an OR
      across a radio group and a separate `<select>`), and both test
      suites.
- [x] **Further correction, same day**: mutual exclusivity, not just "at
      least one" — picking a partner charity clears both delivery-role
      radios; picking a delivery-role radio resets the partner charity
      select. `JoinInForm.tsx` refs + per-element `onChange` on the two
      radios and the select; new Playwright test covering both
      directions.

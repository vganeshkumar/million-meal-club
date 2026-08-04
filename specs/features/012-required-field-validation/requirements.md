# Feature: Required-Field Validation on Join In Submit

## Why
Bug reported by the user (2026-08-03): the Join In form's submit button
(both "Submit Donor Application" and "Submit Volunteer Application") is
clickable before every meaningful field is filled in, and a couple of
fields the original design implied were required
([[../002-join-in-signup/design]] lists `packet_count`/`delivery_role` as
donor fields, `packets_per_trip`/`availability` as volunteer fields,
without ever marking them optional) were never actually enforced as
required by either the frontend or the backend model. The founder's rule,
stated directly: **anything not explicitly labeled "(optional)" is a
required field.**

## Requirements

### The rule
Every Join In field is required unless its label says "(optional)".
Applying that literally to the current form:

- **Shared**: Name (signed out only), Email (signed out only),
  Location/City, Country — already enforced, unchanged.
- **Donor mode, now required**: Number of Food Packets. Already required,
  unchanged: Donor Story, both consent checkboxes.
- **Donor mode, required as a pair, not independently** — **Correction,
  2026-08-04**: Delivery role and "Give through a partner charity
  instead" are **not** two independently-required fields. They're three
  mutually exclusive ways to describe how the donation gets delivered
  (self-deliver, need a volunteer, or via a partner charity) — **at least
  one of the two fields must be set** (a delivery-role radio picked, or a
  partner charity selected), not both. The first version of this spec
  incorrectly required `delivery_role` unconditionally, which blocked a
  donor who only wanted to name a partner charity from ever submitting.
  **Further correction, same day**: since only one of the three delivery
  methods can be true at once, the form actively enforces the mutual
  exclusivity, not just the "at least one" minimum — picking a partner
  charity clears both delivery-role radios, and picking a delivery-role
  radio resets the partner charity select back to "— None, I have my own
  location —". Backend validation is unaffected (it already only checked
  "at least one present," which still holds).
- **Donor mode, stays optional**: Notes.
- **Volunteer mode, now required**: Packets You Can Handle Per Trip,
  Availability. Already optional, unchanged (both explicitly labeled):
  Prior Volunteering Experience, Donor References, Notes.

### Frontend: disable, don't just reject
The Submit button must be **disabled** until every required field for the
current mode is filled — not merely validated (and rejected) after a
click. Switching modes (donor ↔ volunteer) or the signed-in/signed-out
Name+Email swap must immediately re-evaluate which fields count.

### Backend: defense in depth
`POST /api/signups` must reject a payload missing any of the
now-required fields with a `422` and a clear per-field message, exactly
like the existing `donor_story`/checkbox validation — the frontend gate
is a UX improvement, not the only line of defense (a direct API call must
be held to the same rule).

## Out of scope
- Any change to which fields exist or what they mean — this is purely
  about which ones are mandatory.
- Server-side validation of *content* (e.g. a minimum packet count) —
  "required" here means "present and non-empty," same standard as the
  existing `donor_story` check.

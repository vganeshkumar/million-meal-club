# Feature: Join In Signup

## Why
The site's primary participation CTA — but donors and volunteers join very
differently. See the authoritative design
(`design_artifacts/Million Meal Club.dc.html`, `#participate` section) for
full field-level behavior; this spec covers making that form submit to a
real backend. (The `design_handoff_charity_website/` subfolder's README
describes an earlier, simpler "Fund Meals" open-signup version of this form
— superseded, see [[../../01-architecture]] "Source design".)

## Requirements
- Segmented toggle: **"Apply As A Donor"** / **"Volunteer To Deliver"** —
  swaps visible fields and the submit button label; one form, one
  submission, a hidden `signup_type` carries the mode.
- If signed in: Name field replaced by a "Signed in as {name}" chip (name
  comes from the session, not resubmitted by the user); if signed out: a
  normal Name text input. Join In signup does **not** require auth — only
  the Gallery proof upload does.
- Shared fields: Location/City (still required in donor mode, alongside the
  partner-charity alternative below), Notes (optional).
- **Both modes require an email** — from the session if signed in,
  otherwise a required Email field alongside Name. Donor mode has required
  this since 2026-08-03 (see [[../007-donor-application-approval/requirements]]);
  volunteer mode gained the same requirement the same day, once volunteers
  also became a claimable, linkable identity (see
  [[../008-persona-dashboards-and-roles/requirements]]) — a volunteer needs
  an email on file for the same reason a donor does: to recognize them
  again once they sign in for real.

### Donor mode — invitation-only application, not instant sign-up
This is the key behavior change from the original open "Fund Meals" model:
- An info banner: "Donors are by invitation only and commit to delivering a
  minimum of 50,000 meals within 4 years of joining."
- Number of Food Packets (to start).
- Delivery role radio: self-deliver vs. need a volunteer.
- **"Give through a partner charity instead"** — an optional select
  populated from `content.partnerCharities` (see
  [[../006-partner-charities/requirements]]), an alternative to picking
  your own location.
- **Donor Story** — a required textarea: "why are you joining this cause?"
- Two required consent checkboxes:
  1. "I commit to delivering at least 50,000 meals within 4 years of
     joining as a donor."
  2. "I agree to have my story, name, and photos published on this site to
     inspire other donors."
- Submit button reads **"Submit Donor Application"** (not "Count Me In").
- A disclaimer below the button: "This is an application, not an instant
  sign-up — donor spots are limited and reviewed by invitation."
- **Update, 2026-08-03**: this *is* now an in-app approval workflow, not
  purely manual/off-system as originally scoped — the application lands in
  `Signups` with `status: "requested_signoff"`, reviewed via a real admin
  page, and approval creates the donor's real record + sends an onboarding
  email. See [[../007-donor-application-approval/requirements]] for the
  full loop (this is the bulk of what changed; treat that spec as the
  primary source for anything approval-related, this file just owns the
  form itself).

### Volunteer mode
Packets Per Trip, Availability (free text), plus the email requirement
above. **Update, 2026-08-03**: originally submitting immediately created an
unclaimed `Volunteers` record (no approval gate, unlike donors) — see
[[../008-persona-dashboards-and-roles/design]]. Later the same day this was
replaced with a real approval loop, matching donors: the form gained two
more optional fields (prior volunteering experience, donor references),
the submit button now reads "Submit Volunteer Application," and the
application lands in `Signups` with `status: "requested_signoff"` for an
admin to review before the volunteer is linkable — see
[[../011-volunteer-application-approval/requirements]] for the full loop
(treat that spec as the primary source for anything approval-related, this
file just owns the form itself, same relationship this section already has
with [[../007-donor-application-approval/requirements]] for donor mode).

## Out of scope
- Any matching/coordination logic between donors and volunteers, or any
  actual invitation/acceptance workflow — remains entirely manual/off-site,
  same as today.
- Email confirmation to the submitter (nice-to-have, not required).
- Enforcing the 50,000-meal/4-year commitment programmatically (e.g.
  tracking a donor's committed vs. actual total over time) — the checkbox
  is a one-time acknowledgment captured at signup, not a tracked
  obligation.

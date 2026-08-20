# Feature: Charity Partner Admin + Homepage Summary

## Why
[[../006-partner-charities/requirements]] scoped partner charities as
admin-editable content with "the founder edits the table directly for
now" — an explicit, acknowledged gap. Requested by the user (2026-08-10):
there's still no way to add a new partner charity from the site itself,
and the record captured for each one is minimal (name/location/
description) — missing the details a visitor actually wants before
donating through one: how long the charity has been around, any awards
or credentials, and links to their website and to donate directly.
Separately, the homepage has no visibility into partner charities at
all today — a visitor only finds them by already knowing to click
"Partner Charities" in the nav.

## Requirements
- Partner charity records gain four new optional fields: how long the
  charity has been active (free text, e.g. "Since 1998" or "25+ years"),
  awards/credentials (free text), a website link, and a donation link.
  Existing fields (name, location, description) are unchanged and stay
  required.
- New admin-only "Charity Partners" tab (alongside the existing
  Applications, Submissions, Donors, Volunteers, Events tabs — see
  [[../../backend/design]] admin surface) with a form to add a new
  charity partner (name/location/description required, the four new
  fields optional), and a list of existing partner charities below it
  for the admin's own visibility.
- New homepage section, "Charity Partners," showing a summary card per
  partner: name, location, a short description, how long they've been
  active (if set), and "Visit Website"/"Donate" links (if set). The
  section links through to the existing `#charities` page for the full
  list and detail.
- The existing `#charities` page ([[../006-partner-charities/design]])
  also displays the new fields (years active, awards/credentials,
  website/donation links) for each charity, since it's the definitive
  detail view.

## Out of scope
- Editing or deleting an existing partner charity from the admin UI —
  the founder can still hand-edit the table for corrections; only
  *adding* is in scope, per the request.
- Photo/logo upload for a partner charity — not requested.
- Validating that `website_url`/`donation_url` are reachable, or any
  stronger content moderation — same trust-the-founder posture as other
  admin-entered content on this site.

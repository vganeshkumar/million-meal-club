# Feature: Dashboard Profile Tab, Proof-of-Delivery Relocation, Full Event Scheduling

## Why
Requested by the user (2026-08-04), as a follow-up to
[[../018-profile-edit/requirements]]. Three related dashboard changes,
bundled because they all touch the same "My Donations" / "My Volunteering"
surface:

1. Profile editing (added in 018 as an inline section at the top of the
   page) should instead live behind its own left-hand navigation link, in a
   proper settings-style layout — not compete for space with the donation
   history above the fold.
2. The homepage's public "Gallery" section (photo grid + proof-of-delivery
   upload form, see [[../003-photo-proof-submission/requirements]]) is being
   retired from the homepage; submitting proof of a delivery becomes
   something a signed-in donor does from their own "My Donations" page,
   matching how a volunteer already submits proof from "My Volunteering"
   (see [[../008-persona-dashboards-and-roles/design]]).
3. Scheduling a donation event ([[../009-scheduled-donation-events/requirements]])
   today only asks for location/date/volunteer — a donor should be able to
   enter the same richer detail they gave at signup (packet count, delivery
   method, partner charity, notes), just not the fields that now live on
   their Profile tab (location, country, story).

## Requirements

### 1. Profile as a left-nav tab
- "My Donations" and "My Volunteering" each gain a two-column layout: a
  left-hand navigation with two links — the page's existing name (e.g. "My
  Donations") and "Profile" — and a right-hand content frame that swaps
  between the existing dashboard content and the profile-editing form from
  018 depending on which link is active.
- The existing dashboard content (stats, scheduled events, proof
  submission, delivery history for donors; events + submit-for-donor form
  for volunteers) moves under the non-Profile link, unchanged in substance.
- Switching tabs is instant, client-side — no full page reload, no new URL
  hash route required.

### 2. Gallery retires from the homepage; proof submission moves to My Donations
- The homepage no longer shows the "Gallery" section (public photo grid +
  proof-of-delivery upload form) or the "Gallery" header nav link.
- A signed-in donor can submit proof of a delivery directly from their "My
  Donations" page (the non-Profile tab) — same capability the old homepage
  form had: photo (required), receipt (optional), meals delivered,
  location, caption, optional link to one of their own scheduled donation
  events (auto-fills and locks location, shows the assigned volunteer if
  any), optional delivery-role / partner-charity detail.
- This mirrors the volunteer's existing "Submit proof for a donor" form
  already embedded in "My Volunteering" — same pattern, applied to the
  donor's own submissions.
- The public, cross-donor photo grid itself does not move anywhere else; it
  is retired along with the section it lived in (out of scope below).

### 3. Scheduling a donation event asks for full signup-style detail
- The "Schedule Donation" form (on My Donations' main tab) gains the same
  optional fields the original Join In donor application asked for, minus
  whatever now belongs to the Profile tab:
  - Number of Food Packets (`packet_count`)
  - Delivery role — self-deliver or need a volunteer (`delivery_role`)
  - Delivered through a partner charity instead (`partner_charity`)
  - Notes (`notes`)
- Location and Date stay as-is — they describe *this event's* delivery
  site/date, a distinct concept from the donor's own profile location even
  though the field is similarly named.
- None of the new fields are required — a donor can still schedule with
  just a location and date, same as today.

## Out of scope
- Re-adding a public cross-donor photo gallery anywhere else on the site.
- Changing what happens once proof is submitted (approval flow, meal-count
  increment) — unchanged from [[../003-photo-proof-submission/requirements]]
  and [[../004-admin-review-approval/requirements]].
- Requiring (rather than offering) the new donation-event fields, or
  re-validating them the way the original signup's delivery-role/
  partner-charity OR-group was required — scheduling remains
  location+date-only at minimum.
- Any change to the admin Events directory's own display beyond whatever
  falls out naturally from the new optional fields existing.

# Feature: Charity Partner Summary Structure

## Why
Requested by the user (2026-08-20), after trying the admin add/edit flow
from [[../026-charity-partner-admin-and-homepage/requirements]]: a
single free-text `description` blob reads as one dense paragraph. A
visitor deciding whether to give through a partner wants three distinct
things at a glance: what the charity is, what it actually does, and
(when the founder knows it) who's behind it — and the middle one should
stand out visually so it's not missed.

## Requirements
- A partner charity's summary is presented as three paragraphs:
  1. Brief summary of the charity (the existing `description` field —
     relabeled "Brief summary" in the admin form, no schema rename).
  2. Core services — a new field. Visually highlighted (bold / accent
     color) wherever the summary is shown, so it catches the eye ahead of
     the plain-text paragraphs around it.
  3. Founder details — a new, optional field ("if available"): shown only
     when the admin has entered it.
- The admin add/edit form gains "Core services" (required going forward —
  new charities must have it, matching the other two required fields)
  and "Founder details (optional)".
- Both places a charity's full summary renders — the homepage "Charity
  Partners" section and the `#charities` detail page — show all three
  paragraphs in this shape. The admin's own list keeps showing an
  abbreviated view (as today), plus these two new fields.
- Charities created before this feature existed have no `core_services`/
  `founder_details` on file — those paragraphs simply don't render for
  them until an admin edits the record and fills them in. No backfill.

## Out of scope
- Rich text / markdown in any of these fields — plain text, same as
  `description` today.
- Any change to `years_active`, `awards_credentials`, or the website/
  donation links — those stay as separate supporting details, not part
  of the three-paragraph summary.

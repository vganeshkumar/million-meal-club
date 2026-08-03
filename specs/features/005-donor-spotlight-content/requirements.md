# Feature: Donor Spotlight & Content

## Why
Featuring donors (ranked by meals delivered) and their individual delivery
history is a core motivational/social-proof mechanic of the site. See
design README §"Featured Donors" and §"Donor Detail".

## Requirements
- Featured Donors grid: all donors, sorted by `total_meals` descending;
  top-ranked donor gets the amber accent treatment, others get green
  (matching prototype).
- Clicking a donor card opens the Donor Detail view (hash-routed
  `#donor-<id>`, shareable, back-button-friendly) — same mechanism as the
  prototype, now driven by real fetched data instead of a hardcoded array.
- Donor Detail shows: avatar/name/location, total meals + donation count
  stat strip, "Why I'm doing this" story text, and a chronological list of
  their individual approved donations (date, location, meal count, caption,
  photo).
- Only `approved` donations ever appear — pending/rejected submissions are
  invisible to the public, consistent with [[00-constitution]] §5.

## Out of scope
- Donor-editable profiles (the founder edits story text on the donor's
  behalf for now — see [[004-admin-review-approval]]'s note about a
  possible donor-story editor endpoint).

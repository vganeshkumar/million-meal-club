# Feature: Partner Charities

## Why
Not everyone who wants to give money-through-a-third-party has (or wants to
pick) their own delivery location. The authoritative design
(`design_artifacts/Million Meal Club.dc.html`, `#charities` view) adds a
dedicated page listing vetted partner charities as an alternative: donate
directly to one of them instead of picking a location yourself, and still
prove it the same way (receipt + photos from their distribution event).

This is a genuinely new page/data entity, not present in the earlier
(superseded) design — see [[../../01-architecture]] "Source design".

## Requirements
- New nav link **"Partner Charities"** (between "Donors" and "FAQ" in the
  header), routing to a dedicated view via `#charities` (same hash-routing
  mechanism as donor detail — see [[../../01-architecture]]).
- The view: heading "Not sure which location to support?", explanatory copy
  ("Donate money directly to one of these vetted partner charities instead
  of picking a location yourself. Your money goes straight to them — you
  still submit a receipt plus photos from their food distribution event,
  and it counts toward your total the same way."), then a responsive card
  grid of partner charities (name, location, description), then a CTA
  button "Apply As A Donor" linking back to `#participate`.
- Header shows a "← Back to home" button instead of the normal nav when
  this view is open (same treatment as the donor-detail back button).
- Partner charity list is admin-editable content — the founder adds/edits
  charities over time (same treatment as `Events`: backed by a real
  DynamoDB table, editable via the table directly for now, no dedicated
  admin endpoint yet — not a fixed/static list like FAQ).
- The Join In form's donor mode includes a "Give through a partner charity
  instead" select populated from this same list — see
  [[../002-join-in-signup/requirements]].

## Out of scope
- Any actual payment processing or money handling by this site — partner
  charity donations happen entirely off-platform, directly with that
  charity. This site only lists them and captures which one (if any) a
  donor chose, for the founder's own tracking.
- An admin UI/endpoint for managing the charity list (same gap as Events —
  founder edits the table directly for now).

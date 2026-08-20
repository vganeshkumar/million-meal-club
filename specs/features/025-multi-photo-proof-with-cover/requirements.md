# Feature: Multi-Photo Proof With a Chosen Cover

## Why
Requested by the user (2026-08-04). Proof-of-delivery submission
([[../003-photo-proof-submission/requirements]]) only ever accepted one
photo, on both the donor's own submission form and a volunteer's
submit-on-behalf-of-donor form. Donors and volunteers often take several
photos during a delivery; only being able to attach one meant the rest
were lost. At the same time, every display surface that shows a
delivery's photo — homepage completed-events cards, the donor dashboard's
Completed Events list, the admin review queue — was built around a
single fixed-size image, and that fixed-size treatment should stay
exactly as-is; multiple photos shouldn't turn a card into a variable-size
photo grid.

## Requirements

### 1. Up to 5 photos per submission
Both proof-submission paths — the donor's own
([[../019-dashboard-profile-tab-and-proof-relocation/requirements]]) and
a volunteer submitting on a donor's behalf
([[../008-persona-dashboards-and-roles/requirements]]) — accept between 1
and 5 photos per submission (the existing "a photo is required" rule is
unchanged, just no longer capped at exactly one). The optional receipt
upload is unaffected — still exactly one file, unrelated to this photo
list.

### 2. The submitter picks a cover photo
When more than one photo is attached, the submitter designates one as
the "cover" — the photo used anywhere only a single fixed-size image is
shown. Defaults to the first photo attached if the submitter doesn't
explicitly pick one.

### 3. Fixed-size surfaces keep showing only the cover, unchanged
The homepage's completed-events card, the donor dashboard's Completed
Events list-row thumbnail, and any other place that shows a delivery
photo at a fixed size continue to show exactly one image — the chosen
cover — at their existing size. This feature doesn't change those sizes
or turn them into multi-image carousels/grids.

### 4. Detail views show every photo
Clicking into a completed event's detail modal (both the donor
dashboard's and the public homepage's, per
[[../021-completed-event-details/requirements]]) shows all of that
delivery's photos — cover first — in a small fixed-size grid, not just
the cover. Otherwise the extra photos a donor/volunteer took would never
be visible to anyone but the admin reviewer.

### 5. Admin review sees every photo, with the cover indicated
The Pending Submissions review screen
([[../004-admin-review-approval/requirements]]) shows all attached
photos (as it already shows the one photo today), with a visual
indicator of which one the submitter chose as the cover. This is
informational only — approve/reject behavior is unchanged.

## Out of scope
- Editing/re-picking the cover photo after submission (e.g. from the
  donor dashboard after approval) — the cover is fixed at submission
  time, same as every other submitted field.
- Reordering photos beyond which one is the cover.
- Any change to receipt handling, or to the admin approve/reject
  mechanics themselves ([[../004-admin-review-approval/design]]) beyond
  now copying N photos instead of 1 on approval.
- Any change to `infra/` — the S3 bucket and DynamoDB tables involved
  place no schema constraint on how many photo objects/keys a submission
  has.

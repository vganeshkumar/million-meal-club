# Feature: Admin Review & Approval — Design

See [[../../backend/design]] "Submission → approval flow" for the full
step-by-step. This spec focuses on the admin-facing surface.

## Endpoints (all behind `deps.require_admin()`)
- `GET /api/admin/submissions?status=pending` — returns each submission
  plus a short-TTL (~10 min) presigned GET URL for `photo_key` (and
  `receipt_key` if present), so the founder can actually view the image
  without it ever being public.
- `POST /api/admin/submissions/{id}/approve` — see backend design's
  transactional approval steps (S3 copy + `Donations`/`Donors`/`Config`
  updates + submission status flip).
- `POST /api/admin/submissions/{id}/reject` — status flip only.
- `POST /api/admin/config` — partial update of the `Config` singleton item
  (any subset of `total_meals`, `milestone_2027`, `goal_2030`,
  `founder_name`, `charity_name`, `accent_palette`).

## Donor linkage on approval
If the submitting user has no `Donors` row yet, approval creates one
(`name`/`location` from the user + submission, `story` left blank for the
founder to fill in later via `POST /api/admin/config`-style donor edit —
**note**: a `POST /api/admin/donors/{id}` editor endpoint for story text may
be needed; add it here if the founder needs to edit donor stories
independent of submissions). Otherwise, the existing donor's
`total_meals`/`donation_count` are incremented and a new `Donations` row is
appended.

## Concurrency
Two submissions for the same donor approved back-to-back should not race on
the counter increment — use DynamoDB `UpdateItem` with an atomic `ADD`
expression (`total_meals = total_meals + :meals`) rather than read-modify-write,
for both `Donors.total_meals` and `Config.total_meals`.

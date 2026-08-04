# Feature: Admin Application Filter (Donor / Volunteer)

## Why
Bug reported by the user (2026-08-03): since
[[../011-volunteer-application-approval/requirements]] put volunteer
applications in the same `#admin` → Applications queue as donor
applications, an admin reviewing the list has no way to look at just one
kind — everything is interleaved.

## Requirements
- The Applications tab in `#admin` gains a filter control — **All /
  Donor / Volunteer** — above the list.
- Filtering is purely presentational: it narrows which of the already-
  fetched `requested_signoff` applications are shown, matching on
  `mode`. No new endpoint or query param — `GET /api/admin/signups` keeps
  returning both modes together, same as today.
- Default selection is **All** (no behavior change for an admin who
  ignores the new control).
- Approve/Reject continue to act on whichever applications are currently
  visible; nothing changes about the actions themselves.

## Out of scope
- Persisting the selected filter across page loads or admin sessions.
- Filtering the Submissions tab (this is Applications-only — submissions
  have no donor/volunteer distinction the founder asked to filter by).

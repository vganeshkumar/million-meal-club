# Feature: Completed Event Details

## Why
Requested by the user (2026-08-04), as a follow-up to
[[../020-donor-dashboard-lifecycle-nav/requirements]]. Completed Events
lists now exist in two places — the donor's own dashboard and the public
homepage's Events section — but neither showed anything beyond a one-line
summary. The proof photo already exists (that's what got the event marked
completed); it just wasn't surfaced.

## Requirements

### 1. Clicking a completed event shows its details, with photo
Both surfaces — the donor dashboard's Completed Events list
([[../020-donor-dashboard-lifecycle-nav/requirements]]) and the public
homepage's Events section "Completed" tab
([[../014-homepage-scheduled-events/requirements]]) — make each completed
entry clickable. Clicking opens a details view showing date, location,
caption (if any), and the delivery photo. The homepage version also shows
who delivered it (donor name, volunteer or self-delivered).

### 2. The donor's own view also shows the receipt
When a donor views their own Completed Events (not the public homepage),
the details view additionally offers the receipt, if one was uploaded with
that submission — a link to view it, same treatment admins already get in
the Pending Submissions review screen. The receipt is never exposed on the
public homepage or the public donor-detail view
(`GET /api/donors/{id}`) — only to the donor themselves via
`GET /api/donors/me`.

## Out of scope
- Any change to what happens during proof submission or admin review
  itself — this only surfaces data that already existed (photo, caption,
  receipt) once a submission is approved.
- Showing receipts to volunteers, even ones assigned to the event — same
  boundary as before, receipts are donor + admin only.
- A details view for Scheduled or Pending-Approval events — those don't
  have a photo yet (proof hasn't been submitted/approved), so there's
  nothing new to show; they stay as plain list rows.

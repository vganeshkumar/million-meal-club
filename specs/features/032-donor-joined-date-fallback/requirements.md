# Feature: Donor Joined-Date Fallback

## Why
Requested by the user (2026-09-02): a newly approved donor who hasn't
logged a delivery yet showed either a blank area (public donor detail
page) or a bare "No completed deliveries yet." message (donor dashboard)
where their delivery history would go. Showing when they joined instead
gives that space real content.

## Requirements
- A donor's approval date is recorded when their signup is approved (not
  backfilled for existing donors — same "optional in DB" precedent as
  [[031-charity-partner-contact-email]]).
- The public donor detail page (`#donors/{id}`, `DonorDetail.tsx`): when a
  donor has zero donations, show "Joined `<date>`" where the delivery
  list would otherwise render nothing at all. Renders nothing (unchanged
  behavior) for a donor approved before this field existed, who has no
  join date on record either.
- The donor's own dashboard (`DonorDashboard.tsx`'s Completed Events
  section): when a donor has zero donations, append the joined date to
  the existing "No completed deliveries yet." message rather than
  replacing it — that message is still true and useful.
- Once a donor logs their first donation, this fallback stops
  appearing — the actual delivery list takes over, unchanged from today.

## Out of scope
- Backfilling a join date for donors approved before this change.
- Showing the joined date anywhere a donor already has donations.
- Any change to volunteers — only donors were reported as affected.

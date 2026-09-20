# Feature: Donor Joined-Date Fallback

## Why
Requested by the user (2026-09-02): a newly approved donor who hasn't
logged a delivery yet showed a "0 meals delivered" stat on their
homepage "Featured Donors" card — the first place anyone actually sees a
new donor. Showing when they joined instead gives that space real
content. (An initial pass only fixed the donor detail page and dashboard,
missing the homepage card — the request came back a second time
specifically calling that out; this spec now covers all three.)

## Requirements
- A donor's approval date is recorded when their signup is approved (not
  backfilled for existing donors — same "optional in DB" precedent as
  [[031-charity-partner-contact-email]]).
- The homepage "Featured Donors" card (`FeaturedDonors.tsx`, fed by
  `GET /api/content`): when a donor has zero donations, show "Joined
  `<date>`" in place of the "`<N>` meals delivered" stat. Unchanged
  (shows the meals-delivered stat, even at 0) for a donor with no join
  date on record.
- The public donor detail page (`#donor-<id>`, `DonorDetail.tsx`): when a
  donor has zero donations, show "Joined `<date>`" where the delivery
  list would otherwise render nothing at all. Renders nothing (unchanged
  behavior) for a donor approved before this field existed, who has no
  join date on record either.
- The donor's own dashboard (`DonorDashboard.tsx`'s Completed Events
  section): when a donor has zero donations, append the joined date to
  the existing "No completed deliveries yet." message rather than
  replacing it — that message is still true and useful.
- Once a donor logs their first donation, this fallback stops
  appearing everywhere — the actual stats/delivery list take over,
  unchanged from today.

## Out of scope
- Backfilling a join date for donors approved before this change.
- Showing the joined date anywhere a donor already has donations.
- Any change to volunteers — only donors were reported as affected.

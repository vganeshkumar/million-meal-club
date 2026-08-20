# Feature: Charity Partner Edit + Deactivate

## Why
[[../026-charity-partner-admin-and-homepage/requirements]] added a way
for the admin to *add* a partner charity, but explicitly scoped out
editing or deactivating one — "the founder can still hand-edit the table
for corrections." Requested by the user (2026-08-10): that gap should
close too — the admin should be able to correct/update a partner
charity's details, and to deactivate one (e.g. a partnership ends)
without losing the historical record of donations already made through
it.

## Requirements
- The admin's "Charity Partners" tab gains an edit action per charity in
  the list — opens the same field set as the add form, pre-filled,
  saves in place.
- The admin's list gains a deactivate/reactivate action per charity, same
  toggle treatment as the existing Donors/Volunteers tabs
  ([[../016-admin-membership-status/design]]): a status badge plus a
  button that flips it.
- Once deactivated, a partner charity drops out of every *forward-looking*
  list: the homepage "Charity Partners" section, the `#charities` page,
  and the Join In / schedule-a-donation-event "give through a partner
  charity" pickers. It still appears (with a "Disabled" badge) in the
  admin's own list, so it can be reactivated later.
- Deactivating a charity does not touch any `DonationEvent` or
  `Submission` that already recorded giving through it — those keep
  showing that charity's name exactly as before. (This falls out of how
  those already store the charity's name as a plain string at the time of
  giving, not a live reference — no code change needed to preserve it,
  just confirmed as a requirement here.)

## Out of scope
- Deleting a partner charity outright — deactivate covers the "stop
  showing this one" need without losing the id/name history references
  depend on.

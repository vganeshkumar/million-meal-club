# Feature: Post Completed Donation Events to Facebook

## Why
Requested by the user (2026-09-03): when a donation event is scheduled or
completed, they want an image of it posted to a social platform, starting
with the Million Meal Club Facebook Page. Instagram is an explicit later
step, not part of this feature.

A "scheduled" `DonationEvent` ([[../009-scheduled-donation-events/requirements]])
has no photo yet — the only real image available is the delivery-proof
`cover_photo_url`, which only exists once an admin approves a submission
and the event moves to `completed`
([[../025-multi-photo-proof-with-cover/requirements]],
[[../021-completed-event-details/requirements]]). So this feature posts on
**completion**, not on scheduling; posting a generated placeholder graphic
for the scheduled state was considered and rejected as extra complexity for
a lower-value moment.

Per `specs/00-constitution.md` §5, nothing public happens automatically —
approve/reject is already "one reviewed action, never automatic"
([[../004-admin-review-approval/requirements]]). Posting to Facebook
follows the same philosophy: it's a **manual, separate button** the founder
clicks after reviewing the approved submission, never an automatic
side-effect of approval.

Posting requires a Facebook Page access token, which is **not provisioned
yet** — same situation as Google OAuth credentials
([[../001-oauth-login/requirements]]) and the Geoapify API key
([[../023-event-location-time-and-sharing/requirements]]). Until
`FACEBOOK_PAGE_ID` / `FACEBOOK_PAGE_ACCESS_TOKEN` are set, the "Post to
Facebook" action is still visible but fails with a clear "not configured"
message rather than silently no-op'ing or being hidden — the founder should
be able to try it and get an honest answer.

## Requirements
- In the admin "Pending Submissions" panel, approving a submission
  ([[../004-admin-review-approval/requirements]]) no longer removes the
  card from view. Instead the card stays, showing the same cover photo and
  caption it already had, with its action row replaced by **"Post to
  Facebook"** and **"Dismiss"**.
- Clicking "Post to Facebook" posts the submission's `cover_photo_url` to
  the configured Facebook Page as a photo post. The post's caption is the
  donor's caption if one was given, otherwise a generated line ("`{meals}`
  meals delivered to `{location}`!"), with the site's homepage URL appended
  on its own line so Facebook auto-links it — clicking the link in the
  Facebook post takes a viewer back to the Million Meal Club homepage.
- On success, the returned Facebook post id is persisted against the
  submission and the button becomes a disabled "Posted to Facebook ✓" with
  a link to the live post — a page refresh must not lose this state, and
  clicking "Post to Facebook" a second time on an already-posted submission
  must not create a duplicate post.
- If Facebook credentials aren't configured, or the Graph API call fails,
  the admin sees a clear inline error (not a silent failure) and can retry.
- "Dismiss" removes the card from the Pending Submissions view regardless
  of whether it was posted to Facebook — it's a "done reviewing this one"
  action, not tied to the Facebook post outcome.
- Rejecting a submission behaves exactly as before (unchanged) — only the
  approve path changes.

## Out of scope
- Instagram — explicitly deferred by the user to a later step.
- Posting on scheduling (no real photo exists at that point — see "Why").
- Fully automatic posting on approval — always a manual, separate action.
- Editing or deleting a live Facebook post from the admin panel.
- Any Facebook App Review flow — the token is a founder-owned, page-admin
  long-lived token for posting to their own Page, not a public app used by
  other Facebook users.

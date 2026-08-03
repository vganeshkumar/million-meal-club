# Architecture

## Source design
The **authoritative** visual/behavioral design is
`design_artifacts/Million Meal Club.dc.html` (the top-level one, not the
`design_handoff_charity_website/` subfolder). It has no accompanying README
— unlike the subfolder's file, which does — so read the `.dc.html` source
directly (structure + the embedded `faqsData`/`steps`/`partnerCharities`
JS arrays) rather than relying on written docs for it.

`design_artifacts/design_handoff_charity_website/` is an **earlier,
superseded** version (open self-serve "Fund Meals" donor signup, no Partner
Charities page, 5 FAQs) that the app was originally built from before this
discrepancy was found and resolved with the user (2026-08-03) in favor of
the newer file. Its README is still useful for general mechanics that
didn't change (interactions/behavior, design tokens, state management
shape) but its donor-signup copy, FAQ list, and Featured-Donors/Donor-Detail
copy are stale — prefer the top-level `.dc.html` wherever they conflict.

This document is the *system* architecture that implements the
authoritative design for real.

## System diagram

```
                         ┌─────────────────────────┐
                         │   CloudFront (1 dist)   │
                         │  default *.cloudfront.net│
                         │  domain, OAC             │
                         └───────────┬─────────────┘
             ┌────────────────────────┼────────────────────────┐
             │ default behavior       │ /api/*                 │ /photos/*
             ▼                        ▼                        ▼
      ┌─────────────┐         ┌───────────────┐         ┌───────────────┐
      │ S3: site    │         │ API Gateway   │         │ S3: photos    │
      │ (Next.js    │         │ HTTP API      │         │ (private,     │
      │ static      │         │      │        │         │ approved/*    │
      │ export)     │         │      ▼        │         │ readable via  │
      └─────────────┘         │  Lambda       │         │ OAC only)     │
                               │  (FastAPI +   │         └───────────────┘
                               │   Mangum)     │                 ▲
                               └───────┬───────┘                 │
                                       │                  presigned PUT
                                       ▼                  (direct browser
                               ┌───────────────┐           upload) + admin
                               │  DynamoDB     │           CopyObject on
                               │  (on-demand)  │           approval
                               │  Users/Donors/│         ┌───────────────┐
                               │  Donations/   │         │  SES          │
                               │  Submissions/ │────────▶│  (onboarding  │
                               │  Events/      │         │   email)      │
                               │  Signups/     │         └───────────────┘
                               │  PartnerChar-/│
                               │  ities/Config │
                               └───────────────┘
```

## Decisions and why

### One CloudFront distribution, path-routed
`/api/*` → API Gateway, `/photos/*` → photos bucket (scoped to `approved/*`),
everything else → site bucket. One origin domain means the frontend and API
are same-origin: no CORS preflight complexity, and the auth session cookie
can be `SameSite=Lax` instead of needing `SameSite=None; Secure` cross-site
cookie workarounds.

### Compute: Lambda + API Gateway HTTP API
Not REST API (pricier, more features than needed), not ECS/Fargate/EC2 (idle
cost). FastAPI runs via the `Mangum` ASGI adapter. Packaged as a **container
image** (via ECR), not a zip — FastAPI + pydantic + boto3 dependencies are
comfortably under Lambda's 10 GB container image limit but can be awkward
inside the zip package/layer size limits, and container images are the more
future-proof packaging for a growing Python service.

### Data: DynamoDB, on-demand billing
No RDS/Aurora. This app's traffic (a charity site, not a high-QPS product) is
low and spiky — perfect for on-demand pricing, which has zero idle cost and
stays within DynamoDB's always-free tier for a long time. Single-table design
was considered and rejected: the access patterns here are simple
per-entity CRUD + a couple of GSIs, and separate tables are easier to reason
about for a small team/solo founder maintaining this long-term.

Tables (all on-demand):
- `Users` — PK `user_id`. `name`, `email`, `provider`, `created_at`.
- `Donors` — PK `donor_id`. Denormalized aggregate: `name`, `location`,
  `story`, `total_meals`, `donation_count`, `user_id` (unset until claimed —
  see "Donor approval & claiming" below), `email` (internal only — used
  purely to match a later OAuth sign-in to the right donor; **never**
  returned by the public `Donor` API model). GSI `email-index` on `email`
  for that claim lookup.
- `Donations` — PK `donor_id`, SK `donation_id`. `date`, `location`, `meals`,
  `caption`, `photo_key`, `status` (`approved` once counted).
- `Submissions` — PK `submission_id`. Pending/approved/rejected proof
  submissions awaiting founder review. GSI on `status` for the admin queue.
- `Events` — PK `event_id`. `date`, `time`, `location`, `packets_goal`,
  `description`.
- `Signups` — PK `signup_id`. Join In form entries — donor application
  (invitation-only, see [[features/002-join-in-signup/requirements]]) or
  volunteer registration. Donor entries carry `email` (required — see
  [[features/007-donor-application-approval/design]]), `donor_story`,
  `commit_50k_4yr`, `agree_publish_story`, `status`
  (`requested_signoff | approved | rejected`, donor entries only — volunteer
  entries have no status concept), and an optional `partner_charity` name
  in addition to the shared fields. GSI `status-index` on `status`, same
  pattern as `Submissions`. Volunteer entries also now require `email`
  (added with `Volunteers` below) — see
  [[features/008-persona-dashboards-and-roles/design]].
- `Volunteers` — PK `volunteer_id`. Mirrors `Donors`' claiming mechanism
  exactly (`email` internal/claim-only, `user_id` unset until claimed, GSIs
  `email-index` + `user-index`) but with **no approval gate** — created
  immediately at signup, not on admin approval. `name`, `location`,
  `packets_per_trip`, `availability`. See
  [[features/008-persona-dashboards-and-roles/design]].
- `EventSignups` — PK `volunteer_id`, SK `event_id`. A volunteer's RSVP to
  an event. GSI `event-index` on `event_id` (reserved for a future admin
  headcount view, unused today).
- `PartnerCharities` — PK `charity_id`. `name`, `location`, `description`.
  Shown on the Partner Charities page (`#charities`) as a money-donation
  alternative to picking your own location. Admin-editable content (same
  treatment as `Events` — founder edits via the table directly for now, no
  dedicated admin endpoint yet), **not** static like FAQ/steps, since it's
  genuinely a growing list the founder curates.
- `Config` — PK fixed to `"site"`, single item: `total_meals`,
  `milestone_2027`, `goal_2030`, `accent_palette`, `founder_name`,
  `charity_name`. Founder-editable without a code deploy.

Note: the donor detail page's "50,000 / 4 yrs — committed meals" stat is
**static copy**, not a per-donor field — the design's source literally
hardcodes that string rather than interpolating a value, since every donor
commits to the same amount. No `Donors` schema change was needed for it.

### Storage: S3 photos bucket, prefix-scoped access
One private bucket, SSE-S3 encryption, `Block Public Access` on. A bucket
policy grants CloudFront (via OAC) `s3:GetObject` **only** on `approved/*` —
`pending/*` is never reachable except via short-lived presigned URLs the
admin API mints for review.

Flow:
1. Signed-in user requests a presigned PUT (`POST /api/uploads/presign`) →
   uploads directly to `pending/{submission_id}/{filename}` from the browser
   (never proxied through Lambda — avoids payload size limits and cost).
2. User submits proof (`POST /api/submissions`) referencing that key.
3. Founder reviews via `GET /api/admin/submissions?status=pending` (object
   URLs are presigned GETs, short TTL).
4. On approval, the Lambda `CopyObject`s from `pending/...` to
   `approved/{donation_id}/{filename}`, updates `Donations`/`Donors`/`Config`
   counts in one flow, and CloudFront can now serve it publicly.
5. A lifecycle rule expires objects under `pending/*` after 30 days if never
   approved, so rejected/abandoned uploads don't accumulate storage cost.

### Donor approval & claiming
See [[features/007-donor-application-approval/design]] for the full flow.
Summary: a donor application sits as `Signups.status = "requested_signoff"`
until the founder approves it via the admin page — approval creates the
`Donors` row immediately (story/location from the application), *unclaimed*
(`user_id` unset). The donor isn't linked to an actual login until they
later sign in via OAuth **and** attempt something that needs a donor
identity (currently: submitting proof) — at that point the backend looks up
an unclaimed `Donors` row by matching `email` (the `email-index` GSI) to the
signed-in user's session email, and claims it (`user_id = <this user>`).
This is the mechanism behind "sign in with the same name and email, but via
real OAuth" — there's no separate name/email login, just an email-matching
step layered onto normal OAuth sign-in.

**Proof-of-delivery submission now requires a linked donor** (decided with
the user 2026-08-03, when donor approval was added): `POST
/api/uploads/presign` and `POST /api/submissions` 403 for a signed-in user
who isn't already linked and doesn't match an unclaimed approved donor by
email. Pre-existing/seeded donors are unaffected.

**Volunteers get the identical claiming mechanism** (added 2026-08-03, see
[[features/008-persona-dashboards-and-roles/design]]) — a `Volunteers`
GSI `email-index`/`user-index` pair, claimed the same way, except there's
no approval gate (a `Volunteers` row is created immediately at signup, not
on admin approval). This closes the gap noted in the previous version of
this doc: a volunteer delivering *on behalf of* a donor can now submit
proof themselves (attributed to the donor's record via a `donor_id` on the
submission), instead of needing the donor of record to submit it or the
founder to record it manually.

### Onboarding email: AWS SES
On donor approval, the founder's action triggers an onboarding email via
AWS SES (`app/services/email.py`, same `local`/`dynamodb`-keyed split as
every other service — local dev just logs it, no AWS needed). SES over
SNS/a third-party provider because it's the AWS-native tool for exactly
this job and needs no new vendor relationship. **Operational caveat**: a
fresh AWS account's SES starts in sandbox mode, which can only send to
*verified* recipient addresses — real donor inboxes won't receive anything
until the founder requests SES production access from AWS (a short manual
support-ticket step, not something Terraform can do). The Lambda's IAM role
is scoped to `ses:SendEmail`/`ses:SendRawEmail` on the one verified sending
identity ARN only, per [[00-constitution]] §7.

### Auth: client-side OAuth + backend-issued session JWT
Google Identity Services and the Facebook Login JS SDK run client-side and
hand the frontend a provider ID token. The frontend POSTs that token to
`/api/auth/{provider}`; the backend verifies it against the provider's public
keys (`google-auth` library for Google; Facebook Graph `debug_token` endpoint
for Facebook), upserts a `Users` row, and issues its own signed JWT as an
`HttpOnly`, `Secure`, `SameSite=Lax` cookie. No Cognito User Pool — it would
add a moving part (and its own IAM/config surface) for something a stateless
signed JWT already covers cleanly, since we already have a backend to issue
and verify it.

**Instagram is explicitly out of scope for sign-in** (decided with the user):
Meta restricts standalone Instagram consumer login heavily (mostly
business/creator accounts), and the original design only ever wired up
Google + Facebook. Instagram stays a footer follow-link.

### Admin approval reuses the same login
No separate admin credential system. The founder signs in with their normal
Google account; the backend checks the verified email against an
`ADMIN_EMAILS` allowlist (a Lambda environment variable, set via Terraform)
to unlock `/api/admin/*` routes.

**Local-dev-only exception**: `POST /api/auth/dummy` accepts a fixed
`dummy_user`/`dummy_password` username+password (changed from the original
`dummy`/`dummy` — see [[features/008-persona-dashboards-and-roles/design]])
plus a **role** (`admin` / `donor` / `volunteer`), and issues a session for
a synthetic identity scoped to that role — the admin path is unchanged
(first `ADMIN_EMAILS` entry); donor/volunteer auto-provision an idempotent,
already-linked test identity so those dashboards are previewable without
running the real apply/approve flow first. Still gated behind
`ENABLE_DUMMY_LOGIN=true`, which Terraform never sets — see
[[00-constitution]] §4 and
[[features/008-persona-dashboards-and-roles/design]].

### Frontend: Next.js static export, single hash-routed page
`output: 'export'` produces static HTML/CSS/JS deployable to S3. Donor data
is admin-editable at runtime (via DynamoDB, not known at build time), so the
donor detail view is **not** a Next.js dynamic route with
`generateStaticParams` — that would require knowing every donor ID at build
time, which conflicts with runtime-editable content. Instead `app/page.tsx`
reproduces the original design prototype's own behavior: a client-side `view`
state (`"home" | "donor" | "charities"`) synced to `window.location.hash`
(`#donor-<id>` or `#charities`), with donor/event/partner-charity/config
data fetched at runtime from `GET /api/content`. This also means the
founder's approvals (and partner charity list edits) show up on the live
site without a frontend rebuild/redeploy.

### No custom domain yet
`var.domain_name` defaults to `""` in Terraform; when empty, the `dns` module
is skipped and CloudFront's own `*.cloudfront.net` domain is used. Adding a
real domain later is a variable change (plus buying/pointing the domain), not
a redesign — the ACM (us-east-1, required for CloudFront) + Route53
resources are already modeled, just conditional.

## Cost shape
Everything in this architecture scales to (near) zero when unused:
Lambda, API Gateway HTTP API, and DynamoDB on-demand all bill per-request
with generous always-free tiers; S3 and CloudFront bill per-GB at low
charity-site traffic volumes. There is no fixed monthly floor beyond
negligible S3 storage of the site bundle and a handful of DynamoDB items.

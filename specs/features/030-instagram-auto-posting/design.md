# Feature: Instagram Auto-Posting — Design

## Backend
- New `app/services/instagram.py`, mirroring the `EmailSender`
  Protocol/factory pattern in `app/services/email.py`:
  - `InstagramPoster` Protocol: `post(image_url: str, caption: str) -> None`.
  - `NullInstagramPoster` — used when unconfigured; logs and returns,
    same graceful-degradation story `geocode.py`/`oauth.py` already use
    for Geoapify/Google.
  - `GraphApiInstagramPoster` — real implementation against the
    Instagram Graph API (`requests`, already a dependency): two calls,
    `POST /{ig-user-id}/media` (`image_url`, `caption`, `access_token` →
    `{"id": creation_id}`) then `POST /{ig-user-id}/media_publish`
    (`creation_id`, `access_token`). Both use `image_url`, not a direct
    upload — the image must already be reachable at a public URL, which
    is exactly what `blob.public_url()` (approved photos) and the new
    static asset (below) already give us.
  - `get_instagram_poster()` factory — reads
    `INSTAGRAM_ACCESS_TOKEN`/`INSTAGRAM_BUSINESS_ACCOUNT_ID` from env,
    returns `NullInstagramPoster` if either is empty.
- **Scheduled trigger** — `app/routers/donation_events.py`'s
  `create_donation_event`: after `store.create_donation_event(...)`
  returns the new `DonationEvent`, best-effort call
  `get_instagram_poster().post(SCHEDULED_EVENT_IMAGE_URL, caption)`
  wrapped in `try/except Exception` (log and continue — never blocks the
  response). `SCHEDULED_EVENT_IMAGE_URL` is built from the existing
  `SITE_BASE_URL` env var + `/instagram-scheduled-event.png` (the new
  static asset, see Frontend below) — same "empty `SITE_BASE_URL` means
  this feature is inert" fallback the share-page og:image already has,
  so nothing breaks in local dev.
- **Completed trigger** — `app/routers/admin.py`'s `approve_submission`:
  `Store.approve_submission` changes return type from `None` to
  `SubmissionApprovalResult | None` (new small model:
  `donor_name`, `location`, `meals`, `cover_photo_url`) — `None` only
  when the submission didn't exist or wasn't pending (today's silent
  no-op, unchanged). Both `LocalStore` and `DynamoStore` already compute
  everything needed (`approved_cover_key`, `blob.public_url(...)`,
  `s["location"]`, `s["meals"]`); `DynamoStore` additionally needs one
  extra `get_item` on `_donors` for the name (currently only fetches
  `donor_id`). The router then best-effort posts using
  `result.cover_photo_url` when present, same try/except-and-log
  treatment as the scheduled path.
- Both call sites build their caption with a small private helper in
  each router (`_scheduled_event_caption`, `_completed_event_caption`) —
  plain f-strings, not templated, matching how email bodies are built in
  `email.py`.

## Frontend
- New `frontend/public/instagram-scheduled-event.png` — a fixed,
  on-brand 1080×1080 graphic (dark ink→green gradient, wordmark, a short
  "New meal delivery scheduled" line), generated once (Playwright
  screenshot of a throwaway styled HTML file, discarded after — same
  technique already used for this session's verification screenshots,
  not a new runtime dependency). Living under `public/` means it's
  automatically included in every `next build`'s static export and
  synced to S3 on every deploy — no separate upload step to remember,
  and it survives the existing `aws s3 sync --delete` deploy step.
- No other frontend changes — this is a backend-triggered, backend-only
  integration.

## Infra
- `infra/modules/api/variables.tf` gains
  `instagram_access_token` (`sensitive = true`, default `""`) and
  `instagram_business_account_id` (default `""`) — same shape as
  `geoapify_api_key`/`google_client_id`.
- `infra/modules/api/main.tf`'s Lambda `environment.variables` merge
  gains `var.instagram_access_token != "" ? { INSTAGRAM_ACCESS_TOKEN =
  var.instagram_access_token } : {}` and the same conditional shape for
  `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
- `infra/envs/prod/main.tf` wires `instagram_access_token =
  var.instagram_access_token` / `instagram_business_account_id =
  var.instagram_business_account_id` through to the module, with the
  actual values supplied via `secrets.auto.tfvars` (gitignored, same
  file the Geoapify key and session secret already live in) — never
  committed.
- Not wired into `infra/envs/dev` — that environment was destroyed
  ([[../../01-architecture]] history) and isn't being recreated.

## Operational note (not code)
Meta long-lived Page access tokens expire after ~60 days. There's no
refresh automation here — the founder needs to regenerate the token via
Meta's Graph API Explorer or the App dashboard periodically and update
`secrets.auto.tfvars` + re-apply, or just update the Lambda's env var
directly for a faster turnaround (`aws lambda update-function-
configuration`). If the token expires, posting silently starts failing
best-effort (logged in CloudWatch) — the site itself is unaffected.

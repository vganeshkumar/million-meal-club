# Design: Post Completed Donation Events to Facebook

## Data model
Add `facebook_post_id: str | None = None` to the submission record (both
the in-memory dict shape in `local_store.py` and the DynamoDB item in
`dynamo_store.py`) and to `SubmissionAdminView`
(`backend/app/models/domain.py`). `None`/absent means "not posted yet" —
this is the guard against double-posting and the source of truth the
frontend uses to render "Post to Facebook" vs "Posted to Facebook ✓" after
a refresh.

## Backend service — `backend/app/services/facebook.py`
Same `Protocol` + "configured or not" split already used for Geoapify
(`geocode.py`, `staticMap.ts`) — gated on **presence of the token**, not on
`DATA_BACKEND`, so the founder can point local dev at the real Page too:

```python
class FacebookPoster(Protocol):
    def post_photo(self, image_url: str, message: str) -> str: ...  # returns Facebook's post id

class LocalFacebookPoster:
    def post_photo(self, image_url: str, message: str) -> str:
        print(f"[facebook] would post {image_url!r} with message: {message!r}")
        return "local-fake-post-id"

class GraphApiFacebookPoster:
    # POST https://graph.facebook.com/v21.0/{page_id}/photos
    # params: url=<image_url>, caption=<message>, access_token=<token>
    # raises FacebookPostError(detail) on non-2xx or network failure —
    # this is a manual, admin-initiated action, so unlike geocode.py's
    # best-effort no-op-on-failure, failure here must surface loudly.
```

`get_facebook_poster()` returns `GraphApiFacebookPoster` when
`FACEBOOK_PAGE_ACCESS_TOKEN` and `FACEBOOK_PAGE_ID` are both set, else
`LocalFacebookPoster` (mirrors `email.py`'s `get_email_sender()` selector
shape, just keyed on env-var presence instead of `DATA_BACKEND`).

### Why a photo post, not a `/feed` post with a `link` field
The Graph API's `/{page-id}/photos` edge (a photo post directly on the
Page's timeline) has no `link` attachment field — that only exists on
`/feed`. Rather than take on `/feed`'s link-preview-card behavior (which
would show the *linked page's* OG image, not the actual delivery photo),
the delivery photo is posted directly and the homepage URL is appended as
plain text in the caption. Facebook auto-linkifies bare URLs in post
captions, so it renders clickable without needing the `link` field —
satisfies "clicking it links back to the Million Meal Club site" with the
real photo still the primary visual.

## Backend endpoint
`POST /admin/submissions/{submission_id}/post-to-facebook`
(`backend/app/routers/admin.py`, `require_admin`-gated like every other
admin action):
- 404 if the submission doesn't exist.
- 409 if `status != "approved"` (mirrors the "approve first" ordering
  already implicit in the UI) or if `facebook_post_id` is already set
  (double-post guard, belt-and-suspenders with the frontend disabling the
  button).
- 400 if Facebook isn't configured (`FacebookPoster` is the `Local` one) —
  detail: `"Facebook Page posting is not configured yet."`, same tone as
  `auth.py`'s `"ADMIN_EMAILS is not configured"`.
- 502 with the caught detail if `GraphApiFacebookPoster.post_photo` raises.
- On success: calls `get_store().mark_submission_posted_to_facebook(id,
  post_id)`, returns `{"facebook_post_id": post_id}`.

Message text: `submission.caption or f"{submission.meals} meals delivered
to {submission.location}!"`, then `f"\n\n{SITE_BASE_URL}"` appended
(`SITE_BASE_URL` already exists as an env var, see
`donation_events.py`).

## Store
New method on the `Store` Protocol (`store.py`), implemented in both
`local_store.py` and `dynamo_store.py`:
```python
def mark_submission_posted_to_facebook(self, submission_id: str, post_id: str) -> None: ...
```
Sets `facebook_post_id` on the submission record; no-ops if the submission
doesn't exist (same defensive style as `approve_submission`).

## Frontend — `AdminSignoff.tsx`, `PendingSubmissions`
- `handleApprove` no longer filters the approved item out of `submissions`
  — it calls `api.approveSubmission(id)` then locally sets that
  submission's status to `"approved"` (list still comes from
  `listPendingSubmissions()`, i.e. `status=pending`, so this is purely a
  client-side transition to avoid an extra round-trip).
- Card's action row is conditional on submission status:
  - `pending` → existing "Approve" / "Reject" buttons, unchanged.
  - `approved` and no `facebook_post_id` → "Post to Facebook" (calls new
    `api.postSubmissionToFacebook(id)`, shows the caught error inline on
    failure, e.g. "not configured") and "Dismiss" (removes the card from
    local state).
  - `approved` and `facebook_post_id` set → disabled "Posted to Facebook
    ✓" plus a `https://www.facebook.com/{facebook_post_id}` link, and
    "Dismiss".
- `frontend/lib/api.ts`: add
  `postSubmissionToFacebook: (id: string) => request<{ facebook_post_id: string }>(...)`.
- `SubmissionAdminView` TS type gains `facebook_post_id: string | null`.

## Infra
New Terraform variables in `infra/modules/api/variables.tf` (mirrors
`geoapify_api_key`'s shape exactly):
```hcl
variable "facebook_page_id" {
  type        = string
  description = "Million Meal Club Facebook Page id to post completed-event photos to. Empty disables Facebook posting."
  default     = ""
}

variable "facebook_page_access_token" {
  type        = string
  description = "Long-lived Facebook Page access token (pages_manage_posts, pages_read_engagement). Not provisioned yet — same situation as Google OAuth credentials. Pass via a gitignored *.auto.tfvars file, never commit it."
  default     = ""
  sensitive   = true
}
```
Wired into the Lambda's `environment.variables` in
`infra/modules/api/main.tf` the same conditional-merge way as
`geoapify_api_key`:
```hcl
var.facebook_page_id != "" ? { FACEBOOK_PAGE_ID = var.facebook_page_id } : {},
var.facebook_page_access_token != "" ? { FACEBOOK_PAGE_ACCESS_TOKEN = var.facebook_page_access_token } : {},
```
Passed through from both `infra/envs/{dev,prod}/variables.tf` and
`main.tf`, and documented (commented out) in both envs'
`terraform.tfvars.example`. No IAM change needed — this is an outbound
HTTPS call to `graph.facebook.com`, not an AWS API call.

## Getting a Page access token (for the founder, not part of app code)
1. Go to https://developers.facebook.com/apps and create an app (type
   "Business"), owned by the same Facebook account that administers the
   millionmealclub Page.
2. In Graph API Explorer (developers.facebook.com/tools/explorer), pick
   the app, select the millionmealclub Page, and generate a User token
   with `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`.
3. Exchange it for a long-lived Page access token (Graph API's
   `/oauth/access_token?grant_type=fb_exchange_token` flow, or the token
   debugger's "Extend Access Token" button) — these last ~60 days and
   don't expire while the app stays in an active use pattern; Meta's
   Business Suite can also mint a never-expiring System User token if
   longer-lived is wanted.
4. Put the Page's numeric id in `facebook_page_id` and the token in
   `facebook_page_access_token`, in a gitignored `secrets.auto.tfvars` —
   same file/pattern already used for `session_secret`.
No Facebook App Review is needed since this only posts to a Page the same
account administers — App Review only gates access to *other* people's
data/pages.
